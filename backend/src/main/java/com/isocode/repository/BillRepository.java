package com.isocode.repository;

import com.isocode.model.Bill;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

@Repository
public interface BillRepository extends JpaRepository<Bill, UUID> {

    /** All bills for a flat, eager-loading the flat entity. */
    @Query("SELECT b FROM Bill b JOIN FETCH b.flat WHERE b.flat.id = :flatId ORDER BY b.billingMonth DESC")
    List<Bill> findByFlatIdWithFlat(@Param("flatId") UUID flatId);

    /** All bills except those with the given status, eager-loading flat. */
    @Query("SELECT b FROM Bill b JOIN FETCH b.flat WHERE b.status <> :status")
    List<Bill> findByStatusNotWithFlat(@Param("status") Bill.Status status);

    /** Simple status filter (no fetch join — use inside @Transactional). */
    List<Bill> findByStatus(Bill.Status status);

    /** Find by exact amount (before late fee) — used by matching engine. */
    @Query("SELECT b FROM Bill b JOIN FETCH b.flat WHERE b.amount = :amount AND b.status <> :status")
    List<Bill> findByAmountAndStatusNotWithFlat(@Param("amount") BigDecimal amount,
                                                @Param("status") Bill.Status status);
}
