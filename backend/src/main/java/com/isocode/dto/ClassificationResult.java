package com.isocode.dto;

/**
 * Internal result returned by GeminiService.
 * category: one of [Plumbing, Electrical, Civil, Housekeeping, Lift/Elevator,
 *                   Pest Control, Security, Common Area, Safety, Other]
 * urgency : LOW | MEDIUM | HIGH  (never CRITICAL — CRITICAL is rule-only)
 * summary : short rephrasing of the complaint
 */
public record ClassificationResult(
        String category,
        String urgency,
        String summary
) {}
