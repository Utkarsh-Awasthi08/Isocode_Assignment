package com.isocode.repository;

import com.isocode.model.Complaint;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Repository
public interface ComplaintRepository extends JpaRepository<Complaint, UUID> {

    @Query("SELECT c FROM Complaint c JOIN FETCH c.flat WHERE c.flat.id = :flatId ORDER BY c.createdAt DESC")
    List<Complaint> findByFlatId(@Param("flatId") UUID flatId);

    List<Complaint> findByStatus(Complaint.Status status);

    List<Complaint> findByUrgency(Complaint.Urgency urgency);

    @Query("SELECT c FROM Complaint c JOIN FETCH c.flat ORDER BY c.createdAt DESC")
    List<Complaint> findAllByOrderByCreatedAtDesc();

    /**
     * Duplicate detection: open complaints of the same category in the same tower,
     * created after the given cutoff time.
     * Returns root complaints only (duplicateOf IS NULL).
     */
    @Query("""
            SELECT c FROM Complaint c
            JOIN FETCH c.flat f
            WHERE f.tower = :tower
              AND LOWER(c.category) = LOWER(:category)
              AND c.createdAt >= :since
              AND c.status IN :statuses
              AND c.duplicateOf IS NULL
            ORDER BY c.createdAt ASC
            """)
    List<Complaint> findRecentByTowerAndCategory(
            @Param("tower") String tower,
            @Param("category") String category,
            @Param("since") Instant since,
            @Param("statuses") List<Complaint.Status> statuses);
}
