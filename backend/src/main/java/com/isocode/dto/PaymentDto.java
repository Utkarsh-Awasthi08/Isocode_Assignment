package com.isocode.dto;

import com.isocode.model.Payment;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

public record PaymentDto(
        UUID id,
        UUID billId,
        String flatNumber,
        BigDecimal amount,
        String reference,
        String upiId,
        LocalDate transactionDate,
        Payment.Status status,
        Payment.Source source,
        String reviewNote
) {}
