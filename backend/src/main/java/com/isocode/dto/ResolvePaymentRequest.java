package com.isocode.dto;

import jakarta.validation.constraints.NotNull;
import java.util.UUID;

public record ResolvePaymentRequest(
        @NotNull UUID flatId,
        @NotNull UUID billId
) {}
