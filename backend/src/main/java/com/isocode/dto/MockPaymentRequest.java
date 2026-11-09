package com.isocode.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.util.UUID;

public record MockPaymentRequest(
        @NotNull UUID billId,
        @NotNull @DecimalMin("1.00") BigDecimal amount
) {}
