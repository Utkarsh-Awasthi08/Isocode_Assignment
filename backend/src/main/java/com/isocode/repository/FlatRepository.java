package com.isocode.repository;

import com.isocode.model.Flat;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface FlatRepository extends JpaRepository<Flat, UUID> {
    Optional<Flat> findByFlatNumber(String flatNumber);
}
