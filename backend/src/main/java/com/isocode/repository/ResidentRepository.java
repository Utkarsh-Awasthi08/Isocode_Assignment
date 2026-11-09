package com.isocode.repository;

import com.isocode.model.Resident;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.UUID;

@Repository
public interface ResidentRepository extends JpaRepository<Resident, UUID> {
    List<Resident> findByFlatIdAndActiveTrue(UUID flatId);
}
