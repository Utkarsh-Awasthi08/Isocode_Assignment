package com.isocode.dto;

import com.isocode.model.Bill;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

public record BillDto(
        UUID id,
        String flatNumber,
        LocalDate billingMonth,
        BigDecimal amount,
        BigDecimal lateFee,
        BigDecimal amountPaid,
        BigDecimal totalDue,
        Bill.Status status,
        LocalDate dueDate,
        long daysOverdue
) {}
