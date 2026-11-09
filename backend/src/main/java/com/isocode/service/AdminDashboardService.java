package com.isocode.service;

import com.isocode.dto.AdminDashboardDto;
import com.isocode.dto.ComplaintSummaryDto;
import com.isocode.model.Bill;
import com.isocode.model.Complaint;
import com.isocode.model.Payment;
import com.isocode.repository.BillRepository;
import com.isocode.repository.ComplaintRepository;
import com.isocode.repository.PaymentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class AdminDashboardService {

    private final BillRepository billRepository;
    private final PaymentRepository paymentRepository;
    private final ComplaintRepository complaintRepository;

    @Transactional(readOnly = true)
    public AdminDashboardDto getDashboard() {
        List<Bill> allBills = billRepository.findAll();

        BigDecimal totalBilled = allBills.stream()
                .map(b -> b.getAmount().add(b.getLateFee() != null ? b.getLateFee() : BigDecimal.ZERO))
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal totalCollected = allBills.stream()
                .map(b -> b.getAmountPaid() != null ? b.getAmountPaid() : BigDecimal.ZERO)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal totalOutstanding = allBills.stream()
                .map(Bill::getTotalDue)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        long paidCount    = allBills.stream().filter(b -> b.getStatus() == Bill.Status.PAID).count();
        long unpaidCount  = allBills.stream().filter(b -> b.getStatus() == Bill.Status.UNPAID).count();
        long partialCount = allBills.stream().filter(b -> b.getStatus() == Bill.Status.PARTIAL).count();

        long reviewQueueCount      = paymentRepository.findByStatus(Payment.Status.REQUIRES_MANUAL_REVIEW).size();
        long openComplaintsCount   = complaintRepository.findByStatus(Complaint.Status.OPEN).size();
        long criticalCount         = complaintRepository.findByUrgency(Complaint.Urgency.CRITICAL).size();

        List<AdminDashboardDto.DuesAgeing> ageing = calculateAgeing(
                allBills.stream().filter(b -> b.getStatus() != Bill.Status.PAID).toList());

        return new AdminDashboardDto(
                totalBilled, totalCollected, totalOutstanding,
                paidCount, unpaidCount, partialCount,
                reviewQueueCount, openComplaintsCount, criticalCount,
                ageing);
    }

    @Transactional(readOnly = true)
    public List<ComplaintSummaryDto> getAllComplaints() {
        return complaintRepository.findAllByOrderByCreatedAtDesc()
                .stream()
                .map(this::toDto)
                .toList();
    }

    private List<AdminDashboardDto.DuesAgeing> calculateAgeing(List<Bill> unpaid) {
        LocalDate today = LocalDate.now();
        Map<String, List<Bill>> buckets = new LinkedHashMap<>();
        buckets.put("Current (0–30 days)", new ArrayList<>());
        buckets.put("31–60 days",          new ArrayList<>());
        buckets.put("61+ days",            new ArrayList<>());

        for (Bill b : unpaid) {
            long days = b.getDueDate() != null ? ChronoUnit.DAYS.between(b.getDueDate(), today) : 0;
            if (days <= 30)      buckets.get("Current (0–30 days)").add(b);
            else if (days <= 60) buckets.get("31–60 days").add(b);
            else                 buckets.get("61+ days").add(b);
        }

        return buckets.entrySet().stream()
                .map(e -> new AdminDashboardDto.DuesAgeing(
                        e.getKey(),
                        e.getValue().size(),
                        e.getValue().stream()
                                .map(Bill::getTotalDue)
                                .reduce(BigDecimal.ZERO, BigDecimal::add)))
                .toList();
    }

    private ComplaintSummaryDto toDto(Complaint c) {
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
}
