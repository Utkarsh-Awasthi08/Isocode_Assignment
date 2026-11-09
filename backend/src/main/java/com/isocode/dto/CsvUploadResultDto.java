package com.isocode.dto;

import java.util.List;

public record CsvUploadResultDto(
        int totalRows,
        int matchedCount,
        int reviewCount,
        List<PaymentDto> matched,
        List<PaymentDto> requiresReview
) {}
