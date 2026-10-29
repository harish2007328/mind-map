package com.mindmap.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.mindmap.service.MindMapService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/mindmap")
public class MindMapController {

    private final MindMapService mindMapService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public MindMapController(MindMapService mindMapService) {
        this.mindMapService = mindMapService;
    }

    /** Upload a PDF and generate a mind map via Groq. */
    @PostMapping("/generate")
    public ResponseEntity<?> generate(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "title", required = false) String title) {
        try {
            Map<String, Object> result = mindMapService.generateFromPdf(file, title);
            return ResponseEntity.ok(result);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", "Generation failed: " + e.getMessage()));
        }
    }

    /** Save edits to an existing mind map. */
    @PutMapping("/{projectId}/save")
    public ResponseEntity<?> save(
            @PathVariable UUID projectId,
            @RequestBody Map<String, Object> body) {
        try {
            String mapJson = objectMapper.writeValueAsString(body.get("mindMap"));
            String projectTitle = body.get("projectTitle") != null
                    ? body.get("projectTitle").toString() : null;
            Map<String, Object> result =
                    mindMapService.saveMindMap(projectId, mapJson, projectTitle);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", e.getMessage()));
        }
    }

    /** Regenerate a single branch with a fresh Groq call. */
    @PostMapping("/{projectId}/regenerate-branch")
    public ResponseEntity<?> regenerateBranch(
            @PathVariable UUID projectId,
            @RequestBody Map<String, String> body) {
        try {
            String branchTitle = body.get("branchTitle");
            if (branchTitle == null || branchTitle.isBlank()) {
                return ResponseEntity.badRequest()
                        .body(Map.of("error", "branchTitle is required"));
            }
            Map<String, Object> result =
                    mindMapService.regenerateBranch(projectId, branchTitle);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", e.getMessage()));
        }
    }
}
