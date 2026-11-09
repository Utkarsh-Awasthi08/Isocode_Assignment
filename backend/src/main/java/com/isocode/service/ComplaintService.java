package com.isocode.service;

import com.isocode.dto.ClassificationResult;
import com.isocode.dto.ComplaintSubmitRequest;
import com.isocode.dto.ComplaintSummaryDto;
import com.isocode.exception.ResourceNotFoundException;
import com.isocode.model.Complaint;
import com.isocode.model.Flat;
import com.isocode.repository.ComplaintRepository;
import com.isocode.repository.FlatRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * Core complaint routing engine.
 *
 * Processing pipeline for every new complaint:
 *
 *  1. Safety keyword gate — fires BEFORE any LLM call.
 *     Keywords: fire | gas | gas leak | lift stuck | shock | electric shock |
 *               flood | flooding | burning | smoke | explosion
 *     → Category: Safety, Urgency: CRITICAL, Assigned: Duty Manager, Source: RULE_BASED
 *
 *  2. LLM classification (provider-agnostic via LlmService / OpenAI-compat API)
 *     → Category + Urgency from model, Source: AI
 *     AI categories: Plumbing | Electrical | Civil | Housekeeping | Lift/Elevator |
 *                    Pest Control | Security | Common Area | Other
 *     AI urgencies : LOW | MEDIUM | HIGH (CRITICAL is rule-only)
 *
 *  3. Fallback if LLM unavailable or returns invalid JSON
 *     → Category: Uncategorized, Urgency: MEDIUM, Source: MANUAL (queued for help-desk)
 *
 *  4. Duplicate detection — link to an existing open complaint in the same tower
 *     with the same category in the last 48 hours.
 *     Duplicates are LINKED, never auto-closed.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ComplaintService {

    // ── Safety Keywords ───────────────────────────────────────────
    // These ALWAYS escalate to CRITICAL regardless of LLM output.
    private static final List<String> SAFETY_KEYWORDS = List.of(
            "fire", "gas leak", "gas", "lift stuck", "stuck in lift",
            "electric shock", "shock", "flood", "flooding",
            "burning", "smoke", "explosion"
    );

    // ── Category → Assignee Mapping ───────────────────────────────
    private static final Map<String, String> ASSIGNEE_MAP = Map.ofEntries(
            Map.entry("plumbing",      "Plumbing Team"),
            Map.entry("electrical",    "Electrical Team"),
            Map.entry("civil",         "Civil Team"),
            Map.entry("housekeeping",  "Housekeeping Team"),
            Map.entry("lift/elevator", "AMC Team (Lift)"),
            Map.entry("lift",          "AMC Team (Lift)"),
            Map.entry("elevator",      "AMC Team (Lift)"),
            Map.entry("pest control",  "Pest Control Vendor"),
            Map.entry("security",      "Security Team"),
            Map.entry("common area",   "Maintenance Team"),
            Map.entry("safety",        "Duty Manager")
    );

    private final FlatRepository flatRepository;
    private final ComplaintRepository complaintRepository;
    private final LlmService llmService;

    // ─────────────────────────────────────────────────────────────
    // Submit & classify a new complaint
    // ─────────────────────────────────────────────────────────────

    @Transactional
    public ComplaintSummaryDto processAndSave(UUID flatId, ComplaintSubmitRequest request) {
        Flat flat = flatRepository.findById(flatId)
                .orElseThrow(() -> new ResourceNotFoundException("Flat not found: " + flatId));

        String text      = request.description();
        String textLower = text.toLowerCase();

        Complaint.ComplaintBuilder builder = Complaint.builder()
                .flat(flat)
                .description(text)
                .status(Complaint.Status.OPEN);

        // ── Step 1: Safety keyword gate ──────────────────────────
        boolean isSafety = isSafetyEmergency(textLower);

        if (isSafety) {
            log.warn("SAFETY trigger detected in flat {} complaint — CRITICAL escalation to Duty Manager",
                    flat.getFlatNumber());
            builder
                    .category("Safety")
                    .urgency(Complaint.Urgency.CRITICAL)
                    .classificationSource(Complaint.ClassificationSource.RULE_BASED)
                    .assignedTo("Duty Manager");

        } else {
            // ── Step 2: LLM classification ────────────────────────
            Optional<ClassificationResult> aiResult = llmService.classify(text);

            if (aiResult.isPresent()) {
                ClassificationResult cr = aiResult.get();
                log.info("LLM classified complaint as category='{}' urgency='{}'",
                        cr.category(), cr.urgency());
                builder
                        .category(cr.category())
                        .urgency(safeParseUrgency(cr.urgency()))
                        .classificationSource(Complaint.ClassificationSource.AI)
                        .assignedTo(resolveAssignee(cr.category()));
            } else {
                // ── Step 3: Fallback ──────────────────────────────
                log.warn("LLM unavailable for flat {} — flagging for manual review",
                        flat.getFlatNumber());
                builder
                        .category("Uncategorized")
                        .urgency(Complaint.Urgency.MEDIUM)
                        .classificationSource(Complaint.ClassificationSource.MANUAL)
                        .assignedTo("Helpdesk Team");
            }
        }

        Complaint complaint = builder.build();

        // ── Step 4: Duplicate detection ──────────────────────────
        linkDuplicateIfFound(complaint, flat.getTower());

        Complaint saved = complaintRepository.save(complaint);
        log.info("Complaint {} saved — category='{}' urgency='{}' source='{}' duplicate={}",
                saved.getId(), saved.getCategory(), saved.getUrgency(),
                saved.getClassificationSource(),
                saved.getDuplicateOf() != null ? saved.getDuplicateOf().getId() : "none");

        return toDto(saved);
    }

    private boolean isSafetyEmergency(String textLower) {
        if (SAFETY_KEYWORDS.stream().anyMatch(textLower::contains)) {
            return true;
        }
        if (textLower.contains("lift") && textLower.contains("stuck")) {
            return true;
        }
        return false;
    }

    // ─────────────────────────────────────────────────────────────
    // Admin: update complaint lifecycle status
    // ─────────────────────────────────────────────────────────────

    @Transactional
    public ComplaintSummaryDto updateStatus(UUID complaintId, String statusStr) {
        Complaint complaint = findComplaint(complaintId);
        Complaint.Status newStatus = Complaint.Status.valueOf(statusStr.toUpperCase());
        complaint.setStatus(newStatus);
        if (newStatus == Complaint.Status.RESOLVED) {
            complaint.setResolvedAt(Instant.now());
        }
        return toDto(complaintRepository.save(complaint));
    }

    // ─────────────────────────────────────────────────────────────
    // Admin: override LLM category in one tap
    // ─────────────────────────────────────────────────────────────

    @Transactional
    public ComplaintSummaryDto updateCategory(UUID complaintId, String newCategory) {
        Complaint complaint = findComplaint(complaintId);
        complaint.setCategory(newCategory);
        complaint.setClassificationSource(Complaint.ClassificationSource.MANUAL);
        complaint.setAssignedTo(resolveAssignee(newCategory));
        return toDto(complaintRepository.save(complaint));
    }

    // ─────────────────────────────────────────────────────────────
    // Duplicate detection
    // ─────────────────────────────────────────────────────────────

    private void linkDuplicateIfFound(Complaint incoming, String tower) {
        if (incoming.getCategory() == null
                || incoming.getCategory().equalsIgnoreCase("Uncategorized")
                || incoming.getCategory().equalsIgnoreCase("Safety")) {
            return;
        }

        Instant since = Instant.now().minus(48, ChronoUnit.HOURS);
        List<Complaint.Status> openStatuses = List.of(
                Complaint.Status.OPEN,
                Complaint.Status.IN_PROGRESS,
                Complaint.Status.REOPENED);

        complaintRepository
                .findRecentByTowerAndCategory(tower, incoming.getCategory(), since, openStatuses)
                .stream()
                .filter(c -> c.getDuplicateOf() == null)
                .findFirst()
                .ifPresent(parent -> {
                    incoming.setDuplicateOf(parent);
                    log.info("Linked complaint as duplicate of {} (category='{}', tower={})",
                            parent.getId(), incoming.getCategory(), tower);
                });
    }

    // ─────────────────────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────────────────────

    private Complaint findComplaint(UUID id) {
        return complaintRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Complaint not found: " + id));
    }

    private Complaint.Urgency safeParseUrgency(String urgency) {
        try {
            return Complaint.Urgency.valueOf(urgency.toUpperCase());
        } catch (IllegalArgumentException e) {
            return Complaint.Urgency.MEDIUM;
        }
    }

    private String resolveAssignee(String category) {
        if (category == null) return "Helpdesk Team";
        return ASSIGNEE_MAP.getOrDefault(category.toLowerCase(), "Helpdesk Team");
    }

    public ComplaintSummaryDto toDto(Complaint c) {
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
