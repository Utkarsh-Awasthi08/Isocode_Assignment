package com.isocode.controller;

import com.isocode.dto.*;
import com.isocode.model.Resident;
import com.isocode.repository.FlatRepository;
import com.isocode.repository.ResidentRepository;
import com.isocode.service.AdminDashboardService;
import com.isocode.service.ComplaintService;
import com.isocode.service.PaymentMatchingService;
import com.opencsv.exceptions.CsvValidationException;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminController {

    private final AdminDashboardService dashboardService;
    private final PaymentMatchingService matchingService;
    private final ComplaintService complaintService;
    private final FlatRepository flatRepository;
    private final ResidentRepository residentRepository;

    // ── Dashboard ────────────────────────────────────────────────

    /** Collections summary + dues ageing + complaint stats. */
    @GetMapping("/dashboard")
    public AdminDashboardDto getDashboard() {
        return dashboardService.getDashboard();
    }

    // ── Flats ────────────────────────────────────────────────────

    /**
     * All flats with resident name — used by manual review UI
     * when accounts team needs to pick a flat for an ambiguous payment.
     */
    @GetMapping("/flats")
    @Transactional(readOnly = true)
    public List<FlatSummaryDto> getAllFlats() {
        return flatRepository.findAll().stream()
                .map(flat -> {
                    String residentName = residentRepository
                            .findByFlatIdAndActiveTrue(flat.getId())
                            .stream().findFirst()
                            .map(Resident::getName)
                            .orElse("—");
                    return new FlatSummaryDto(flat.getId(), flat.getFlatNumber(),
                            flat.getTower(), residentName);
                })
                .toList();
    }

    // ── Payments ─────────────────────────────────────────────────

    /**
     * Upload a bank statement CSV for automatic payment matching.
     * Expected CSV header: Date,Description,Amount,Reference,UPI_ID
     */
    @PostMapping(value = "/payments/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public CsvUploadResultDto uploadBankStatement(@RequestParam("file") MultipartFile file)
            throws IOException, CsvValidationException {
        if (file.isEmpty()) {
            throw new IllegalArgumentException("Uploaded file is empty");
        }
        return matchingService.processCSV(file);
    }

    /** Payments requiring manual assignment. */
    @GetMapping("/payments/review")
    public List<PaymentDto> getReviewQueue() {
        return matchingService.getReviewQueue();
    }

    /**
     * Accounts team manually assigns an ambiguous payment to a flat + bill.
     * Ambiguous payments are NEVER auto-posted — only via this endpoint.
     */
    @PostMapping("/payments/{id}/resolve")
    public PaymentDto resolvePayment(
            @PathVariable UUID id,
            @Valid @RequestBody ResolvePaymentRequest request) {
        return matchingService.resolveManualReview(id, request);
    }

    // ── Complaints ───────────────────────────────────────────────

    /** All complaints, newest first, with AI/rule classification tags. */
    @GetMapping("/complaints")
    public List<ComplaintSummaryDto> getAllComplaints() {
        return dashboardService.getAllComplaints();
    }

    /**
     * Update complaint lifecycle status.
     * status param: OPEN | IN_PROGRESS | RESOLVED | REOPENED
     */
    @PatchMapping("/complaints/{id}/status")
    public ComplaintSummaryDto updateStatus(
            @PathVariable UUID id,
            @RequestParam String status) {
        return complaintService.updateStatus(id, status);
    }

    /**
     * Help-desk overrides AI category in one tap.
     * Sets classificationSource to MANUAL and re-assigns to the right team.
     */
    @PatchMapping("/complaints/{id}/category")
    public ComplaintSummaryDto updateCategory(
            @PathVariable UUID id,
            @RequestParam String category) {
        return complaintService.updateCategory(id, category);
    }
}
