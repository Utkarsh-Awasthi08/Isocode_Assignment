package com.isocode.dto;

import java.math.BigDecimal;
import java.util.List;

public record AdminDashboardDto(
        BigDecimal totalBilled,
        BigDecimal totalCollected,
        BigDecimal totalOutstanding,
        long paidCount,
        long unpaidCount,
        long partialCount,
        long reviewQueueCount,
        long openComplaintsCount,
        long criticalComplaintsCount,
        List<DuesAgeing> ageing
) {
    public record DuesAgeing(String bucket, long count, BigDecimal amount) {}
}
