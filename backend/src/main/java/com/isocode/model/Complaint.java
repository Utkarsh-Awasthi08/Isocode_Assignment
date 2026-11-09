package com.isocode.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "complaints")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Complaint {

    public enum Urgency              { LOW, MEDIUM, HIGH, CRITICAL }
    public enum Status               { OPEN, IN_PROGRESS, RESOLVED, REOPENED }
    public enum ClassificationSource { RULE_BASED, AI, MANUAL }

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "flat_id", nullable = false)
    private Flat flat;

    @Column(name = "description", nullable = false, columnDefinition = "TEXT")
    private String description;

    @Column(name = "category", length = 50)
    private String category;

    @Builder.Default
    @Enumerated(EnumType.STRING)
    @Column(name = "urgency", nullable = false, length = 20)
    private Urgency urgency = Urgency.MEDIUM;

    @Builder.Default
    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private Status status = Status.OPEN;

    @Column(name = "assigned_to", length = 100)
    private String assignedTo;

    @Builder.Default
    @Enumerated(EnumType.STRING)
    @Column(name = "classification_source", nullable = false, length = 20)
    private ClassificationSource classificationSource = ClassificationSource.AI;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "duplicate_of")
    private Complaint duplicateOf;

    @Builder.Default
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @Builder.Default
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    @Column(name = "resolved_at")
    private Instant resolvedAt;

    @Column(name = "rating")
    private Short rating;

    @PreUpdate
    public void onUpdate() {
        this.updatedAt = Instant.now();
    }
}
