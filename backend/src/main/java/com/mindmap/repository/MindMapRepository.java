package com.mindmap.repository;

import com.mindmap.model.MindMap;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface MindMapRepository extends JpaRepository<MindMap, UUID> {
    List<MindMap> findByProjectId(UUID projectId);
    Optional<MindMap> findFirstByProjectIdOrderByUpdatedAtDesc(UUID projectId);
}
