package com.mindmap.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "nodes")
public class MindMapNode {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "mind_map_id", nullable = false)
    private MindMap mindMap;

    @Column(name = "parent_id")
    private UUID parentId;

    @Column(nullable = false, length = 500)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "source_page")
    private Integer sourcePage;

    @Column(name = "position_x")
    private Double positionX;

    @Column(name = "position_y")
    private Double positionY;

    @Column(name = "sort_order")
    private Integer sortOrder = 0;

    @Column(name = "is_collapsed")
    private Boolean isCollapsed = false;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    // ── Getters & Setters ──────────────────────────────
    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public MindMap getMindMap() { return mindMap; }
    public void setMindMap(MindMap m) { this.mindMap = m; }

    public UUID getParentId() { return parentId; }
    public void setParentId(UUID p) { this.parentId = p; }

    public String getTitle() { return title; }
    public void setTitle(String t) { this.title = t; }

    public String getDescription() { return description; }
    public void setDescription(String d) { this.description = d; }

    public Integer getSourcePage() { return sourcePage; }
    public void setSourcePage(Integer s) { this.sourcePage = s; }

    public Double getPositionX() { return positionX; }
    public void setPositionX(Double x) { this.positionX = x; }

    public Double getPositionY() { return positionY; }
    public void setPositionY(Double y) { this.positionY = y; }

    public Integer getSortOrder() { return sortOrder; }
    public void setSortOrder(Integer s) { this.sortOrder = s; }

    public Boolean getIsCollapsed() { return isCollapsed; }
    public void setIsCollapsed(Boolean c) { this.isCollapsed = c; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime c) { this.createdAt = c; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime u) { this.updatedAt = u; }
}
