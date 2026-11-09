package com.isocode.model;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "flats")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Flat {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "flat_number", nullable = false, unique = true, length = 20)
    private String flatNumber;

    @Column(name = "tower", nullable = false, length = 10)
    private String tower;

    @Column(name = "area_sqft", nullable = false, precision = 8, scale = 2)
    private BigDecimal areaSqft;

    @Column(name = "rate_per_sqft", nullable = false, precision = 6, scale = 2)
    private BigDecimal ratePerSqft;

    @Builder.Default
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();
}
