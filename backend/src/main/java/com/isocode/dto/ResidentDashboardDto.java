package com.isocode.dto;

import java.math.BigDecimal;
import java.util.List;

public record ResidentDashboardDto(
        String flatNumber,
        String residentName,
        BigDecimal totalDue,
        List<BillDto> pendingBills,
        List<ComplaintSummaryDto> openComplaints
) {}
