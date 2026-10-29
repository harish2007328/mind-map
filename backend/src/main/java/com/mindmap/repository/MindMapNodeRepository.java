package com.mindmap.repository;

import com.mindmap.model.MindMapNode;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface MindMapNodeRepository extends JpaRepository<MindMapNode, UUID> {
    List<MindMapNode> findByMindMapId(UUID mindMapId);
    List<MindMapNode> findByMindMapIdAndParentId(UUID mindMapId, UUID parentId);
    void deleteByMindMapId(UUID mindMapId);
}
