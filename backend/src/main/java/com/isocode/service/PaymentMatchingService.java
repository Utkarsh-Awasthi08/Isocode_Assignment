package com.isocode.service;

import com.isocode.dto.CsvUploadResultDto;
import com.isocode.dto.PaymentDto;
import com.isocode.dto.ResolvePaymentRequest;
import com.isocode.exception.ResourceNotFoundException;
import com.isocode.model.Bill;
import com.isocode.model.Flat;
import com.isocode.model.Payment;
import com.isocode.model.Resident;
import com.isocode.repository.BillRepository;
import com.isocode.repository.FlatRepository;
import com.isocode.repository.PaymentRepository;
import com.isocode.repository.ResidentRepository;
import com.opencsv.CSVReader;
import com.opencsv.exceptions.CsvValidationException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStreamReader;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.*;

@Service
@RequiredArgsConstructor
@Slf4j
public class PaymentMatchingService {

    private static final List<DateTimeFormatter> DATE_FORMATTERS = List.of(
            DateTimeFormatter.ISO_LOCAL_DATE,                          // yyyy-MM-dd
            DateTimeFormatter.ofPattern("d/M/yyyy"),                   // 5/10/2024 or 05/10/2024
            DateTimeFormatter.ofPattern("d-M-yyyy"),                   // 5-10-2024 or 05-10-2024
            DateTimeFormatter.ofPattern("d-MMM-yyyy", Locale.ENGLISH), // 05-Oct-2024
            DateTimeFormatter.ofPattern("d MMM yyyy", Locale.ENGLISH)  // 05 Oct 2024
    );

    private final BillRepository billRepository;
    private final PaymentRepository paymentRepository;
    private final FlatRepository flatRepository;
    private final ResidentRepository residentRepository;

    // ─────────────────────────────────────────────────────────────
    // CSV Upload & Matching Engine
    // ─────────────────────────────────────────────────────────────

    /**
     * Matching Algorithm:
     * 1. Load all UNPAID / PARTIAL bills (candidates pool).
     * 2. For each CSV row:
     *    a. Check if reference/UPI/description uniquely identifies a pending flat.
     *    b. Check if amount matches pending dues (total due, remaining base, etc.).
     *    c. Exactly 1 clear candidate  → MATCHED.
     *    d. >1 candidates or ambiguous → REQUIRES_MANUAL_REVIEW (never auto-post).
     *    e. 0 candidates               → REQUIRES_MANUAL_REVIEW.
     * 3. After matching a bill, remove it from the candidate pool to avoid double-matching.
     */
    @Transactional
    public CsvUploadResultDto processCSV(MultipartFile file) throws IOException, CsvValidationException {
        List<String[]> rows = parseCSV(file);
        if (rows.isEmpty()) {
            return new CsvUploadResultDto(0, 0, 0, List.of(), List.of());
        }

        // Build header → index map (case-insensitive and BOM-stripped)
        String[] headers = rows.get(0);
        Map<String, Integer> idx = buildHeaderIndex(headers);

        // Load all unpaid/partial bills — mutable list so we can remove matched ones
        List<Bill> candidatePool = new ArrayList<>(billRepository.findByStatusNotWithFlat(Bill.Status.PAID));

        List<PaymentDto> matched = new ArrayList<>();
        List<PaymentDto> review  = new ArrayList<>();

        for (int i = 1; i < rows.size(); i++) {
            String[] row = rows.get(i);
            if (row.length == 0 || (row.length == 1 && row[0].isBlank())) continue;

            try {
                PaymentDto result = processRow(row, idx, candidatePool);
                if (result.status() == Payment.Status.MATCHED) {
                    matched.add(result);
                    // Remove matched bill from pool to prevent double-match in the same file
                    if (result.billId() != null) {
                        candidatePool.removeIf(b -> b.getId().equals(result.billId()));
                    }
                } else {
                    review.add(result);
                }
            } catch (Exception e) {
                log.error("Error processing CSV row {}: {}", i, Arrays.toString(row), e);
                Payment errPayment = Payment.builder()
                        .amount(BigDecimal.ZERO)
                        .transactionDate(LocalDate.now())
                        .status(Payment.Status.REQUIRES_MANUAL_REVIEW)
                        .source(Payment.Source.CSV_IMPORT)
                        .reviewNote("Parse error on row " + i + ": " + e.getMessage())
                        .build();
                paymentRepository.save(errPayment);
                review.add(toDto(errPayment));
            }
        }

        log.info("CSV processed: {} total rows, {} matched, {} needs review",
                rows.size() - 1, matched.size(), review.size());
        return new CsvUploadResultDto(rows.size() - 1, matched.size(), review.size(), matched, review);
    }

    private PaymentDto processRow(String[] row, Map<String, Integer> idx, List<Bill> candidatePool) {
        String rawAmount = col(row, idx, "AMOUNT", "0").replaceAll("[^0-9.]", "");
        BigDecimal amount = rawAmount.isBlank() ? BigDecimal.ZERO : new BigDecimal(rawAmount);

        String reference   = col(row, idx, "REFERENCE", "");
        String upiId       = col(row, idx, "UPI_ID", "");
        String description = col(row, idx, "DESCRIPTION", "");
        LocalDate date     = parseDate(col(row, idx, "DATE", LocalDate.now().toString()));

        Payment payment = Payment.builder()
                .amount(amount)
                .reference(reference.isBlank() ? null : reference)
                .upiId(upiId.isBlank() ? null : upiId)
                .description(description.isBlank() ? null : description)
                .transactionDate(date)
                .source(Payment.Source.CSV_IMPORT)
                .build();

        if (amount.compareTo(BigDecimal.ZERO) <= 0) {
            payment.setStatus(Payment.Status.REQUIRES_MANUAL_REVIEW);
            payment.setReviewNote("Invalid or zero amount");
            return toDto(paymentRepository.save(payment));
        }

        // 1. Direct Reference / Flat identification in candidate pool
        List<Bill> referenceMatches = candidatePool.stream()
                .filter(b -> referenceMatchesBill(reference, upiId, description, b))
                .toList();

        // 2. Amount matches in candidate pool
        List<Bill> amountMatches = candidatePool.stream()
                .filter(b -> isAmountMatch(b, amount))
                .toList();

        if (referenceMatches.size() == 1) {
            // Uniquely identified by reference / flat / resident name
            Bill target = referenceMatches.get(0);
            matchPaymentToBill(payment, target);

        } else if (referenceMatches.isEmpty() && amountMatches.size() == 1) {
            // Unambiguous single match by exact amount
            Bill target = amountMatches.get(0);
            matchPaymentToBill(payment, target);

        } else if (amountMatches.size() > 1) {
            // Ambiguous amount match: multiple flats owe this amount and reference is unclear
            payment.setStatus(Payment.Status.REQUIRES_MANUAL_REVIEW);
            payment.setReviewNote(amountMatches.size() + " flats owe ₹" + amount
                    + "; reference unclear — requires manual review");

        } else {
            // 0 matches found in pending candidate pool
            payment.setStatus(Payment.Status.REQUIRES_MANUAL_REVIEW);
            payment.setReviewNote("No pending bill found matching amount ₹" + amount);
        }

        Payment saved = paymentRepository.save(payment);
        return toDto(saved);
    }

    private boolean isAmountMatch(Bill b, BigDecimal amount) {
        if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) return false;

        BigDecimal totalDue = b.getTotalDue();
        BigDecimal remainingBase = b.getAmount().subtract(b.getAmountPaid() != null ? b.getAmountPaid() : BigDecimal.ZERO);
        BigDecimal originalAmount = b.getAmount();
        BigDecimal totalWithLate = b.getAmount().add(b.getLateFee() != null ? b.getLateFee() : BigDecimal.ZERO);

        return totalDue.compareTo(amount) == 0
                || remainingBase.compareTo(amount) == 0
                || originalAmount.compareTo(amount) == 0
                || totalWithLate.compareTo(amount) == 0;
    }

    private void matchPaymentToBill(Payment payment, Bill bill) {
        payment.setFlat(bill.getFlat());
        payment.setBill(bill);
        payment.setStatus(Payment.Status.MATCHED);

        BigDecimal paidSoFar = bill.getAmountPaid() != null ? bill.getAmountPaid() : BigDecimal.ZERO;
        BigDecimal lateFee   = bill.getLateFee() != null ? bill.getLateFee() : BigDecimal.ZERO;

        bill.setAmountPaid(paidSoFar.add(payment.getAmount()));
        BigDecimal remaining = bill.getAmount().add(lateFee).subtract(bill.getAmountPaid());
        bill.setStatus(remaining.compareTo(BigDecimal.ZERO) <= 0 ? Bill.Status.PAID : Bill.Status.PARTIAL);
        billRepository.save(bill);

        log.debug("Matched ₹{} → flat {} bill {}", payment.getAmount(),
                bill.getFlat().getFlatNumber(), bill.getId());
    }

    /**
     * Reference disambiguation: returns true if the reference/UPI/description
     * contains the flat number (normalized), resident's name, or last 4 digits of phone.
     */
    private boolean referenceMatchesBill(String reference, String upiId, String description, Bill bill) {
        if (bill == null || bill.getFlat() == null) return false;

        String flatNum = bill.getFlat().getFlatNumber().toLowerCase().replaceAll("[^a-z0-9]", "");
        String combined = (Objects.toString(reference, "") + " "
                + Objects.toString(upiId, "") + " "
                + Objects.toString(description, ""))
                .toLowerCase().replaceAll("[^a-z0-9@.]", "");

        if (!flatNum.isEmpty() && combined.contains(flatNum)) return true;

        // Also check tower + unit without leading zeros (e.g. T12-408 vs T12-0408)
        String tower = bill.getFlat().getTower() != null ? bill.getFlat().getTower().toLowerCase() : "";
        String rawFlat = bill.getFlat().getFlatNumber().toLowerCase();
        if (rawFlat.contains("-")) {
            String[] parts = rawFlat.split("-");
            if (parts.length == 2) {
                String unitClean = parts[1].replaceFirst("^0+", "");
                if (!unitClean.isEmpty() && !tower.isEmpty()) {
                    if (combined.contains(tower) && combined.contains(unitClean)) {
                        return true;
                    }
                }
            }
        }

        // Check resident names and phone numbers
        List<Resident> residents = residentRepository.findByFlatIdAndActiveTrue(bill.getFlat().getId());
        for (Resident r : residents) {
            if (r.getPhone() != null && r.getPhone().length() >= 4) {
                String last4 = r.getPhone().substring(r.getPhone().length() - 4);
                if (combined.contains(last4)) return true;
            }
            if (r.getName() != null) {
                String[] nameTokens = r.getName().toLowerCase().split("\\s+");
                for (String token : nameTokens) {
                    if (token.length() >= 3 && combined.contains(token)) return true;
                }
            }
        }
        return false;
    }

    // ─────────────────────────────────────────────────────────────
    // Manual Review Queue
    // ─────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<PaymentDto> getReviewQueue() {
        return paymentRepository.findByStatusWithDetails(Payment.Status.REQUIRES_MANUAL_REVIEW)
                .stream()
                .map(this::toDto)
                .toList();
    }

    @Transactional
    public PaymentDto resolveManualReview(UUID paymentId, ResolvePaymentRequest request) {
        Payment payment = paymentRepository.findById(paymentId)
                .orElseThrow(() -> new ResourceNotFoundException("Payment not found: " + paymentId));

        if (payment.getStatus() != Payment.Status.REQUIRES_MANUAL_REVIEW) {
            throw new IllegalArgumentException("Payment is not in REQUIRES_MANUAL_REVIEW state");
        }

        Flat flat = flatRepository.findById(request.flatId())
                .orElseThrow(() -> new ResourceNotFoundException("Flat not found: " + request.flatId()));
        Bill bill = billRepository.findById(request.billId())
                .orElseThrow(() -> new ResourceNotFoundException("Bill not found: " + request.billId()));

        if (!bill.getFlat().getId().equals(flat.getId())) {
            throw new IllegalArgumentException("Bill does not belong to the specified flat");
        }

        payment.setFlat(flat);
        payment.setBill(bill);
        payment.setStatus(Payment.Status.MATCHED);
        payment.setReviewNote("Manually resolved by accounts team");

        BigDecimal paidSoFar = bill.getAmountPaid() != null ? bill.getAmountPaid() : BigDecimal.ZERO;
        BigDecimal lateFee   = bill.getLateFee() != null ? bill.getLateFee() : BigDecimal.ZERO;
        bill.setAmountPaid(paidSoFar.add(payment.getAmount()));
        BigDecimal remaining = bill.getAmount().add(lateFee).subtract(bill.getAmountPaid());
        bill.setStatus(remaining.compareTo(BigDecimal.ZERO) <= 0 ? Bill.Status.PAID : Bill.Status.PARTIAL);
        billRepository.save(bill);

        log.info("Payment {} manually resolved to flat {} bill {}", paymentId, flat.getFlatNumber(), bill.getId());
        return toDto(paymentRepository.save(payment));
    }

    // ─────────────────────────────────────────────────────────────
    // CSV Parsing
    // ─────────────────────────────────────────────────────────────

    private List<String[]> parseCSV(MultipartFile file) throws IOException, CsvValidationException {
        List<String[]> rows = new ArrayList<>();
        try (CSVReader reader = new CSVReader(new InputStreamReader(file.getInputStream()))) {
            String[] line;
            while ((line = reader.readNext()) != null) {
                rows.add(line);
            }
        }
        return rows;
    }

    private Map<String, Integer> buildHeaderIndex(String[] headers) {
        Map<String, Integer> idx = new HashMap<>();
        for (int i = 0; i < headers.length; i++) {
            String key = headers[i].trim().replace("\uFEFF", "").toUpperCase().replace(" ", "_");
            idx.put(key, i);
        }
        return idx;
    }

    private String col(String[] row, Map<String, Integer> idx, String key, String defaultVal) {
        Integer i = idx.get(key);
        if (i == null) {
            if ("AMOUNT".equals(key)) {
                i = firstNonNull(idx.get("AMT"), idx.get("CREDIT"), idx.get("CR"), idx.get("TXN_AMOUNT"));
            } else if ("REFERENCE".equals(key)) {
                i = firstNonNull(idx.get("REF"), idx.get("REF_NO"), idx.get("REFERENCE_NO"), idx.get("UTR"), idx.get("TXN_ID"));
            } else if ("UPI_ID".equals(key)) {
                i = firstNonNull(idx.get("UPI"), idx.get("VPA"), idx.get("UPI_REF"));
            } else if ("DESCRIPTION".equals(key)) {
                i = firstNonNull(idx.get("DESC"), idx.get("NARRATION"), idx.get("PARTICULARS"), idx.get("REMARKS"));
            } else if ("DATE".equals(key)) {
                i = firstNonNull(idx.get("TXN_DATE"), idx.get("VALUE_DATE"), idx.get("TRANSACTION_DATE"));
            }
        }
        if (i == null || i >= row.length) return defaultVal;
        String v = row[i].trim();
        return v.isEmpty() ? defaultVal : v;
    }

    @SafeVarargs
    private static <T> T firstNonNull(T... items) {
        for (T item : items) {
            if (item != null) return item;
        }
        return null;
    }

    private LocalDate parseDate(String raw) {
        if (raw == null || raw.isBlank()) return LocalDate.now();
        String trimmed = raw.trim();
        for (DateTimeFormatter fmt : DATE_FORMATTERS) {
            try {
                return LocalDate.parse(trimmed, fmt);
            } catch (DateTimeParseException ignored) {
            }
        }
        log.warn("Could not parse date '{}' with known formats, defaulting to today", raw);
        return LocalDate.now();
    }

    // ─────────────────────────────────────────────────────────────
    // DTO Mapper
    // ─────────────────────────────────────────────────────────────

    private PaymentDto toDto(Payment p) {
        return new PaymentDto(
                p.getId(),
                p.getBill()  != null ? p.getBill().getId()           : null,
                p.getFlat()  != null ? p.getFlat().getFlatNumber()   : null,
                p.getAmount(),
                p.getReference(),
                p.getUpiId(),
                p.getTransactionDate(),
                p.getStatus(),
                p.getSource(),
                p.getReviewNote());
    }
}
