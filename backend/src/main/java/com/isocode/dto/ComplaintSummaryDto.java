package com.isocode.dto;

import com.isocode.model.Complaint;
import java.time.Instant;
import java.util.UUID;

public record ComplaintSummaryDto(
        UUID id,
        String flatNumber,
        String description,
        String category,
        Complaint.Urgency urgency,
        Complaint.Status status,
        String classificationSource,
        Instant createdAt
) {}
