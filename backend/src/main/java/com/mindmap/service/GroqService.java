package com.mindmap.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.*;

/**
 * Communicates with the Groq API (OpenAI-compatible) to generate
 * structured mind-map JSON from document text.
 */
@Service
public class GroqService {

    private static final Logger log = LoggerFactory.getLogger(GroqService.class);

    @Value("${groq.api.key}")
    private String apiKey;

    @Value("${groq.api.url}")
    private String apiUrl;

    @Value("${groq.model}")
    private String model;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final RestTemplate restTemplate = new RestTemplate();

    /* ───────────────────────────────────────────────────────
     *  Generate a full mind-map from a single text block
     * ─────────────────────────────────────────────────────── */
    public String generateMindMap(String documentText) {
        String system = """
                You are an expert at analysing documents and creating structured mind maps.
                Given the document text, generate a comprehensive mind-map hierarchy.

                Return ONLY valid JSON (no markdown fences) with this exact structure:
                {
                  "title": "Central Topic",
                  "description": "A concise 1-2 sentence summary",
                  "children": [
                    {
                      "title": "Main Branch",
                      "description": "Brief explanation",
                      "sourcePage": 1,
                      "children": [
                        {
                          "title": "Sub-branch",
                          "description": "Brief explanation",
                          "sourcePage": 2,
                          "children": []
                        }
                      ]
                    }
                  ]
                }

                Rules:
                - Create 3-7 main branches
                - Each branch may have 2-5 sub-branches; sub-branches may nest up to 3 levels
                - Titles: concise, under 60 characters
                - Descriptions: 1-2 sentences
                - Include sourcePage when identifiable from "--- Page X ---" markers; otherwise null
                - Return ONLY the JSON object
                """;

        return callGroq(system, documentText);
    }

    /* ───────────────────────────────────────────────────────
     *  Multi-chunk: analyse each chunk then merge
     * ─────────────────────────────────────────────────────── */
    public String generateMindMapFromChunks(List<String> chunks) {
        if (chunks.size() == 1) return generateMindMap(chunks.get(0));

        List<String> partials = new ArrayList<>();
        for (int i = 0; i < chunks.size(); i++) {
            String user = String.format(
                    "This is part %d of %d of a document. Identify key topics:\n\n%s",
                    i + 1, chunks.size(), chunks.get(i));

            String system = """
                    Analyse this document section and return ONLY a JSON array of topics:
                    [{"title":"...","description":"...","sourcePage":1,"subtopics":["a","b"]}]
                    """;

            String result = callGroq(system, user);
            if (result != null) partials.add(result);
        }

        String mergeUser = "Merge these partial topic analyses into one mind map:\n\n"
                + String.join("\n\n---\n\n", partials);

        String mergeSystem = """
                Merge the partial analyses into a single cohesive mind map.
                Combine related topics, remove duplicates, create a clean hierarchy.

                Return ONLY valid JSON:
                {
                  "title": "Central Topic",
                  "description": "Summary",
                  "children": [
                    { "title":"...", "description":"...", "sourcePage":null, "children":[...] }
                  ]
                }
                Create 3-7 main branches. Return ONLY JSON.
                """;

        return callGroq(mergeSystem, mergeUser);
    }

    /* ───────────────────────────────────────────────────────
     *  Regenerate a single branch
     * ─────────────────────────────────────────────────────── */
    public String regenerateBranch(String branchTitle, String documentContext) {
        String system = """
                Regenerate a single mind-map branch with a fresh, deeper analysis.

                Return ONLY valid JSON:
                {
                  "title": "Branch Title",
                  "description": "Updated description",
                  "sourcePage": null,
                  "children": [
                    { "title":"Sub-topic", "description":"...", "sourcePage":null, "children":[] }
                  ]
                }
                Create 2-5 sub-branches. Return ONLY JSON.
                """;

        String user = String.format(
                "Document context:\n%.6000s\n\nBranch to regenerate: %s\n\nProvide a fresh analysis.",
                documentContext, branchTitle);

        return callGroq(system, user);
    }

    /* ───────────────────────────────────────────────────────
     *  Low-level Groq API call
     * ─────────────────────────────────────────────────────── */
    private String callGroq(String systemPrompt, String userPrompt) {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.setBearerAuth(apiKey);

            Map<String, Object> body = new LinkedHashMap<>();
            body.put("model", model);
            body.put("messages", List.of(
                    Map.of("role", "system", "content", systemPrompt),
                    Map.of("role", "user", "content", userPrompt)
            ));
            body.put("temperature", 0.3);
            body.put("max_tokens", 4096);
            body.put("response_format", Map.of("type", "json_object"));

            HttpEntity<Map<String, Object>> request = new HttpEntity<>(body, headers);
            ResponseEntity<String> response =
                    restTemplate.exchange(apiUrl, HttpMethod.POST, request, String.class);

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                JsonNode root = objectMapper.readTree(response.getBody());
                String content = root.path("choices").get(0)
                        .path("message").path("content").asText();
                // Validate that the content is parseable JSON
                objectMapper.readTree(content);
                return content;
            }

            throw new RuntimeException("Groq API returned " + response.getStatusCode());
        } catch (Exception e) {
            log.error("Groq API call failed: {}", e.getMessage());
            throw new RuntimeException("AI generation failed: " + e.getMessage(), e);
        }
    }
}
