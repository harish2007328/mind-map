package com.mindmap.controller;

import com.mindmap.service.MindMapService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/projects")
public class ProjectController {

    private final MindMapService mindMapService;

    public ProjectController(MindMapService mindMapService) {
        this.mindMapService = mindMapService;
    }

    /** List recent projects for the dashboard. */
    @GetMapping
    public ResponseEntity<List<Map<String, Object>>> listProjects() {
        return ResponseEntity.ok(mindMapService.getRecentProjects());
    }

    /** Get a single project with its mind map. */
    @GetMapping("/{projectId}")
    public ResponseEntity<?> getProject(@PathVariable UUID projectId) {
        try {
            return ResponseEntity.ok(mindMapService.getMindMap(projectId));
        } catch (RuntimeException e) {
            return ResponseEntity.status(404)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    /** Delete a project and all related data. */
    @DeleteMapping("/{projectId}")
    public ResponseEntity<Map<String, String>> deleteProject(
            @PathVariable UUID projectId) {
        try {
            mindMapService.deleteProject(projectId);
            return ResponseEntity.ok(Map.of("message", "Project deleted"));
        } catch (Exception e) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", e.getMessage()));
        }
    }
}
