package com.isocode.dto;

import java.util.UUID;

/** Thin flat record used by admin UI when assigning a manual payment review. */
public record FlatSummaryDto(
        UUID id,
        String flatNumber,
        String tower,
        String residentName
) {}
