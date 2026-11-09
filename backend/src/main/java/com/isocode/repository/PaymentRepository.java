package com.isocode.repository;

import com.isocode.model.Payment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface PaymentRepository extends JpaRepository<Payment, UUID> {

    List<Payment> findByStatus(Payment.Status status);

    @Query("SELECT p FROM Payment p LEFT JOIN FETCH p.flat LEFT JOIN FETCH p.bill WHERE p.status = :status ORDER BY p.createdAt DESC")
    List<Payment> findByStatusWithDetails(@Param("status") Payment.Status status);

    List<Payment> findByFlatId(UUID flatId);
}
