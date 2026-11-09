package com.isocode.service;

import com.isocode.dto.*;
import com.isocode.exception.ResourceNotFoundException;
import com.isocode.model.*;
import com.isocode.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class BillingService {

    private final FlatRepository flatRepository;
    private final BillRepository billRepository;
    private final PaymentRepository paymentRepository;
    private final ResidentRepository residentRepository;
    private final ComplaintRepository complaintRepository;

    // ─────────────────────────────────────────────────────────────
    // Resident Dashboard
    // ─────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public ResidentDashboardDto getDashboard(UUID flatId) {
        Flat flat = findFlat(flatId);
        String residentName = residentRepository.findByFlatIdAndActiveTrue(flatId)
                .stream().findFirst().map(Resident::getName).orElse("Resident");

        List<BillDto> pendingBills = billRepository.findByFlatIdWithFlat(flatId)
                .stream()
                .filter(b -> b.getStatus() != Bill.Status.PAID)
                .map(this::toBillDto)
                .toList();

        BigDecimal totalDue = pendingBills.stream()
                .map(BillDto::totalDue)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        List<ComplaintSummaryDto> openComplaints = complaintRepository.findByFlatId(flatId)
                .stream()
                .filter(c -> c.getStatus() != Complaint.Status.RESOLVED)
                .map(this::toComplaintDto)
                .toList();

        return new ResidentDashboardDto(flat.getFlatNumber(), residentName, totalDue, pendingBills, openComplaints);
    }

    @Transactional(readOnly = true)
    public List<BillDto> getBills(UUID flatId) {
        findFlat(flatId); // validate
        return billRepository.findByFlatIdWithFlat(flatId)
                .stream()
                .map(this::toBillDto)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<ComplaintSummaryDto> getComplaints(UUID flatId) {
        findFlat(flatId);
        return complaintRepository.findByFlatId(flatId)
                .stream()
                .map(this::toComplaintDto)
                .toList();
    }

    // ─────────────────────────────────────────────────────────────
    // Mock Payment
    // ─────────────────────────────────────────────────────────────

    @Transactional
    public PaymentDto processMockPayment(UUID flatId, MockPaymentRequest request) {
        Flat flat = findFlat(flatId);
        Bill bill = billRepository.findById(request.billId())
                .orElseThrow(() -> new ResourceNotFoundException("Bill not found: " + request.billId()));

        if (!bill.getFlat().getId().equals(flatId)) {
            throw new IllegalArgumentException("Bill does not belong to flat " + flatId);
        }
        if (bill.getStatus() == Bill.Status.PAID) {
            throw new IllegalArgumentException("Bill is already fully paid");
        }
        if (request.amount().compareTo(bill.getTotalDue()) > 0) {
            throw new IllegalArgumentException(
                    "Payment amount ₹" + request.amount() + " exceeds outstanding due ₹" + bill.getTotalDue());
        }

        // Create payment
        Payment payment = Payment.builder()
                .flat(flat)
                .bill(bill)
                .amount(request.amount())
                .reference("MOCK-" + System.currentTimeMillis())
                .transactionDate(LocalDate.now())
                .status(Payment.Status.MATCHED)
                .source(Payment.Source.MOCK)
                .build();

        // Update bill
        BigDecimal paidSoFar = bill.getAmountPaid() != null ? bill.getAmountPaid() : BigDecimal.ZERO;
        BigDecimal lateFee   = bill.getLateFee() != null ? bill.getLateFee() : BigDecimal.ZERO;
        bill.setAmountPaid(paidSoFar.add(request.amount()));
        BigDecimal remaining = bill.getAmount().add(lateFee).subtract(bill.getAmountPaid());
        bill.setStatus(remaining.compareTo(BigDecimal.ZERO) <= 0 ? Bill.Status.PAID : Bill.Status.PARTIAL);
        billRepository.save(bill);

        Payment saved = paymentRepository.save(payment);
        log.info("Mock payment {} created for flat {} bill {}", saved.getId(), flatId, bill.getId());
        return toPaymentDto(saved);
    }

    // ─────────────────────────────────────────────────────────────
    // DTO Mappers
    // ─────────────────────────────────────────────────────────────

    public BillDto toBillDto(Bill bill) {
        long daysOverdue = 0;
        if (bill.getStatus() != Bill.Status.PAID && bill.getDueDate() != null) {
            daysOverdue = Math.max(0, ChronoUnit.DAYS.between(bill.getDueDate(), LocalDate.now()));
        }
        return new BillDto(
                bill.getId(),
                bill.getFlat() != null ? bill.getFlat().getFlatNumber() : "—",
                bill.getBillingMonth(),
                bill.getAmount(),
                bill.getLateFee() != null ? bill.getLateFee() : BigDecimal.ZERO,
                bill.getAmountPaid() != null ? bill.getAmountPaid() : BigDecimal.ZERO,
                bill.getTotalDue(),
                bill.getStatus(),
                bill.getDueDate(),
                daysOverdue);
    }

    public ComplaintSummaryDto toComplaintDto(Complaint c) {
        return new ComplaintSummaryDto(
                c.getId(),
                c.getFlat() != null ? c.getFlat().getFlatNumber() : "—",
                c.getDescription(),
                c.getCategory(),
                c.getUrgency(),
                c.getStatus(),
                c.getClassificationSource() != null ? c.getClassificationSource().name() : "MANUAL",
                c.getCreatedAt());
    }

    public PaymentDto toPaymentDto(Payment p) {
        return new PaymentDto(
                p.getId(),
                p.getBill() != null ? p.getBill().getId() : null,
                p.getFlat() != null ? p.getFlat().getFlatNumber() : null,
                p.getAmount(),
                p.getReference(),
                p.getUpiId(),
                p.getTransactionDate(),
                p.getStatus(),
                p.getSource(),
                p.getReviewNote());
    }

    // ─────────────────────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────────────────────

    private Flat findFlat(UUID flatId) {
        return flatRepository.findById(flatId)
                .orElseThrow(() -> new ResourceNotFoundException("Flat not found: " + flatId));
    }
}
