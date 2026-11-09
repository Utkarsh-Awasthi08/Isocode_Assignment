package com.isocode.controller;

import com.isocode.dto.*;
import com.isocode.service.BillingService;
import com.isocode.service.ComplaintService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/**
 * Mock authentication: resident identity is passed via ?flatId= query param.
 * Phase 5+ will add proper OTP-based auth.
 */
@RestController
@RequestMapping("/api/resident")
@RequiredArgsConstructor
public class ResidentController {

    private final BillingService billingService;
    private final ComplaintService complaintService;

    /** Home screen data: dues summary + open complaints. */
    @GetMapping("/dashboard")
    public ResidentDashboardDto getDashboard(@RequestParam UUID flatId) {
        return billingService.getDashboard(flatId);
    }

    /** All bills for a flat (all statuses). */
    @GetMapping("/bills")
    public List<BillDto> getBills(@RequestParam UUID flatId) {
        return billingService.getBills(flatId);
    }

    /** Simulate an online payment (test mode — no real gateway). */
    @PostMapping("/payments/mock")
    public ResponseEntity<PaymentDto> mockPayment(
            @RequestParam UUID flatId,
            @Valid @RequestBody MockPaymentRequest request) {
        PaymentDto result = billingService.processMockPayment(flatId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(result);
    }

    /** All complaints for a flat. */
    @GetMapping("/complaints")
    public List<ComplaintSummaryDto> getComplaints(@RequestParam UUID flatId) {
        return billingService.getComplaints(flatId);
    }

    /**
     * Submit a new complaint.
     *
     * Processing pipeline (all inside ComplaintService):
     *   1. Safety keyword gate  → CRITICAL + Duty Manager (skips AI)
     *   2. Gemini AI classify   → Category + Urgency
     *   3. Fallback             → Uncategorized / MEDIUM (manual review)
     *   4. Duplicate detection  → link, never close
     */
    @PostMapping("/complaints")
    public ResponseEntity<ComplaintSummaryDto> submitComplaint(
            @RequestParam UUID flatId,
            @Valid @RequestBody ComplaintSubmitRequest request) {
        ComplaintSummaryDto dto = complaintService.processAndSave(flatId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(dto);
    }
}
