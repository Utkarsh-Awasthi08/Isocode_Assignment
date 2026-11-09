package com.isocode.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ComplaintSubmitRequest(
        @NotBlank @Size(min = 10, max = 2000) String description
) {}
