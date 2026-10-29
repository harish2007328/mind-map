package com.mindmap.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.mindmap.model.*;
import com.mindmap.repository.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.*;

/**
 * Core orchestration service – ties together PDF extraction,
 * Groq AI generation, and database persistence.
 */
@Service
public class MindMapService {

    private static final Logger log = LoggerFactory.getLogger(MindMapService.class);

    private final PdfService pdfService;
    private final GroqService groqService;
    private final ProjectRepository projectRepo;
    private final DocumentRepository documentRepo;
    private final MindMapRepository mindMapRepo;
    private final MindMapNodeRepository nodeRepo;
    private final ObjectMapper objectMapper;

    public MindMapService(PdfService pdfService,
                          GroqService groqService,
                          ProjectRepository projectRepo,
                          DocumentRepository documentRepo,
                          MindMapRepository mindMapRepo,
                          MindMapNodeRepository nodeRepo) {
        this.pdfService = pdfService;
        this.groqService = groqService;
        this.projectRepo = projectRepo;
        this.documentRepo = documentRepo;
        this.mindMapRepo = mindMapRepo;
        this.nodeRepo = nodeRepo;
        this.objectMapper = new ObjectMapper();
    }

    /* ================================================================
     *  Generate a brand-new mind map from an uploaded PDF
     * ================================================================ */
    @Transactional
    public Map<String, Object> generateFromPdf(MultipartFile file, String projectTitle)
            throws IOException {

        // 1. Create project
        Project project = new Project();
        String title = (projectTitle != null && !projectTitle.isBlank())
                ? projectTitle
                : (file.getOriginalFilename() != null
                        ? file.getOriginalFilename().replaceAll("\\.pdf$", "")
                        : "Untitled");
        project.setTitle(title);
        project = projectRepo.save(project);

        // 2. Extract PDF text
        PdfService.PdfExtractionResult extraction = pdfService.extractText(file);

        // 3. Persist document metadata + extracted text
        Document document = new Document();
        document.setProject(project);
        document.setOriginalFilename(file.getOriginalFilename());
        document.setFileSize(file.getSize());
        document.setPageCount(extraction.pageCount());
        document.setProcessingStatus("processing");
        document.setExtractedText(extraction.fullText());
        document = documentRepo.save(document);

        // 4. Call Groq AI
        String mindMapJson;
        List<String> chunks = pdfService.splitIntoChunks(extraction.fullText());

        try {
            mindMapJson = (chunks.size() > 1)
                    ? groqService.generateMindMapFromChunks(chunks)
                    : groqService.generateMindMap(extraction.fullText());
        } catch (Exception e) {
            document.setProcessingStatus("failed");
            documentRepo.save(document);
            throw new RuntimeException("AI generation failed: " + e.getMessage(), e);
        }

        // 5. Validate the AI response
        JsonNode mindMapTree;
        try {
            mindMapTree = objectMapper.readTree(mindMapJson);
            if (!mindMapTree.has("title") || !mindMapTree.has("children")) {
                throw new RuntimeException("AI returned an incomplete mind-map structure");
            }
        } catch (Exception e) {
            document.setProcessingStatus("failed");
            documentRepo.save(document);
            throw new RuntimeException("Invalid AI response: " + e.getMessage(), e);
        }

        // 6. Persist mind map + individual nodes
        MindMap mindMap = new MindMap();
        mindMap.setProject(project);
        mindMap.setMapStructure(mindMapJson);
        mindMap = mindMapRepo.save(mindMap);

        saveNodesFromJson(mindMapTree, mindMap, null, 0);

        document.setProcessingStatus("completed");
        documentRepo.save(document);

        // 7. Build response
        Map<String, Object> res = new LinkedHashMap<>();
        res.put("projectId", project.getId());
        res.put("mindMapId", mindMap.getId());
        res.put("documentId", document.getId());
        res.put("mindMap", mindMapTree);
        res.put("pageCount", extraction.pageCount());
        return res;
    }

    /* ================================================================
     *  Load an existing mind map by project ID
     * ================================================================ */
    public Map<String, Object> getMindMap(UUID projectId) {
        Project project = projectRepo.findById(projectId)
                .orElseThrow(() -> new RuntimeException("Project not found"));

        MindMap mindMap = mindMapRepo
                .findFirstByProjectIdOrderByUpdatedAtDesc(projectId)
                .orElseThrow(() -> new RuntimeException("No mind map for this project"));

        List<Document> docs = documentRepo.findByProjectId(projectId);

        Map<String, Object> res = new LinkedHashMap<>();
        res.put("projectId", project.getId());
        res.put("projectTitle", project.getTitle());
        res.put("mindMapId", mindMap.getId());
        try {
            res.put("mindMap", objectMapper.readTree(mindMap.getMapStructure()));
        } catch (Exception e) {
            res.put("mindMap", mindMap.getMapStructure());
        }
        if (!docs.isEmpty()) {
            res.put("documentName", docs.get(0).getOriginalFilename());
            res.put("pageCount", docs.get(0).getPageCount());
        }
        return res;
    }

    /* ================================================================
     *  Save edits to an existing mind map
     * ================================================================ */
    @Transactional
    public Map<String, Object> saveMindMap(UUID projectId,
                                           String mapStructure,
                                           String projectTitle) {
        Project project = projectRepo.findById(projectId)
                .orElseThrow(() -> new RuntimeException("Project not found"));

        if (projectTitle != null && !projectTitle.isBlank()) {
            project.setTitle(projectTitle);
            projectRepo.save(project);
        }

        MindMap mindMap = mindMapRepo
                .findFirstByProjectIdOrderByUpdatedAtDesc(projectId)
                .orElseThrow(() -> new RuntimeException("Mind map not found"));

        // Validate JSON
        try { objectMapper.readTree(mapStructure); }
        catch (Exception e) { throw new RuntimeException("Invalid JSON structure"); }

        mindMap.setMapStructure(mapStructure);
        mindMapRepo.save(mindMap);

        // Re-create node rows from the updated tree
        nodeRepo.deleteByMindMapId(mindMap.getId());
        try {
            saveNodesFromJson(objectMapper.readTree(mapStructure), mindMap, null, 0);
        } catch (Exception e) {
            log.warn("Could not rebuild node rows: {}", e.getMessage());
        }

        Map<String, Object> res = new LinkedHashMap<>();
        res.put("projectId", project.getId());
        res.put("mindMapId", mindMap.getId());
        res.put("saved", true);
        return res;
    }

    /* ================================================================
     *  Regenerate one branch via Groq
     * ================================================================ */
    @Transactional(readOnly = true)
    public Map<String, Object> regenerateBranch(UUID projectId, String branchTitle) {
        mindMapRepo.findFirstByProjectIdOrderByUpdatedAtDesc(projectId)
                .orElseThrow(() -> new RuntimeException("Mind map not found"));

        List<Document> docs = documentRepo.findByProjectId(projectId);
        String docText = docs.isEmpty() ? "" : docs.get(0).getExtractedText();
        if (docText != null && docText.length() > 8000) {
            docText = docText.substring(0, 8000);
        }

        String regenerated = groqService.regenerateBranch(
                branchTitle, docText != null ? docText : "");

        Map<String, Object> res = new LinkedHashMap<>();
        res.put("projectId", projectId);
        try {
            res.put("branch", objectMapper.readTree(regenerated));
        } catch (Exception e) {
            throw new RuntimeException("Invalid AI response for branch regeneration");
        }
        return res;
    }

    /* ================================================================
     *  List recent projects (dashboard)
     * ================================================================ */
    public List<Map<String, Object>> getRecentProjects() {
        List<Map<String, Object>> result = new ArrayList<>();
        for (Project p : projectRepo.findAllByOrderByUpdatedAtDesc()) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", p.getId());
            m.put("title", p.getTitle());
            m.put("createdAt", p.getCreatedAt());
            m.put("updatedAt", p.getUpdatedAt());

            List<Document> docs = documentRepo.findByProjectId(p.getId());
            if (!docs.isEmpty()) {
                m.put("documentName", docs.get(0).getOriginalFilename());
                m.put("pageCount", docs.get(0).getPageCount());
            }
            result.add(m);
        }
        return result;
    }

    /* ================================================================
     *  Delete a project and all its children
     * ================================================================ */
    @Transactional
    public void deleteProject(UUID projectId) {
        List<MindMap> maps = mindMapRepo.findByProjectId(projectId);
        for (MindMap mm : maps) nodeRepo.deleteByMindMapId(mm.getId());
        mindMapRepo.deleteAll(maps);
        documentRepo.deleteAll(documentRepo.findByProjectId(projectId));
        projectRepo.deleteById(projectId);
    }

    /* ────────────────────────────────────────────────────────
     *  Recursively persist individual node rows from the JSON tree
     * ──────────────────────────────────────────────────────── */
    private void saveNodesFromJson(JsonNode node, MindMap mindMap,
                                   UUID parentId, int sortOrder) {
        MindMapNode n = new MindMapNode();
        n.setMindMap(mindMap);
        n.setParentId(parentId);
        n.setTitle(node.path("title").asText("Untitled"));
        n.setDescription(node.path("description").asText(""));
        n.setSortOrder(sortOrder);

        if (node.has("sourcePage") && !node.path("sourcePage").isNull()) {
            n.setSourcePage(node.path("sourcePage").asInt());
        }

        n = nodeRepo.save(n);

        JsonNode children = node.path("children");
        if (children.isArray()) {
            for (int i = 0; i < children.size(); i++) {
                saveNodesFromJson(children.get(i), mindMap, n.getId(), i);
            }
        }
    }
}
