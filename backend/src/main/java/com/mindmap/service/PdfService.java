package com.mindmap.service;

import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.*;

@Service
public class PdfService {

    private static final Logger log = LoggerFactory.getLogger(PdfService.class);
    private static final long MAX_FILE_SIZE = 20L * 1024 * 1024;   // 20 MB
    private static final int MAX_CHARS_PER_CHUNK = 12_000;

    /**
     * Result of a PDF text extraction, carrying the full text,
     * per-page text map, and total page count.
     */
    public record PdfExtractionResult(
            String fullText,
            Map<Integer, String> pageTexts,
            int pageCount
    ) {}

    /**
     * Extract text from an uploaded PDF, preserving page-number markers
     * so the AI can reference source pages.
     */
    public PdfExtractionResult extractText(MultipartFile file) throws IOException {
        validateFile(file);

        try (PDDocument document = PDDocument.load(file.getInputStream())) {
            int pageCount = document.getNumberOfPages();
            Map<Integer, String> pageTexts = new LinkedHashMap<>();
            StringBuilder fullText = new StringBuilder();

            PDFTextStripper stripper = new PDFTextStripper();

            for (int page = 1; page <= pageCount; page++) {
                stripper.setStartPage(page);
                stripper.setEndPage(page);
                String pageText = stripper.getText(document).trim();
                if (!pageText.isEmpty()) {
                    pageTexts.put(page, pageText);
                    fullText.append("\n--- Page ").append(page).append(" ---\n");
                    fullText.append(pageText);
                }
            }

            log.info("Extracted {} pages, {} chars from '{}'",
                    pageCount, fullText.length(), file.getOriginalFilename());

            return new PdfExtractionResult(fullText.toString().trim(), pageTexts, pageCount);
        }
    }

    /**
     * Split long text into manageable chunks, preferring page-boundary
     * or paragraph breaks for clean separation.
     */
    public List<String> splitIntoChunks(String text) {
        List<String> chunks = new ArrayList<>();
        if (text.length() <= MAX_CHARS_PER_CHUNK) {
            chunks.add(text);
            return chunks;
        }

        int start = 0;
        while (start < text.length()) {
            int end = Math.min(start + MAX_CHARS_PER_CHUNK, text.length());

            if (end < text.length()) {
                // Prefer breaking at a page marker
                int pageBreak = text.lastIndexOf("\n--- Page ", end);
                if (pageBreak > start) {
                    end = pageBreak;
                } else {
                    // Fall back to paragraph boundary
                    int paraBreak = text.lastIndexOf("\n\n", end);
                    if (paraBreak > start) {
                        end = paraBreak;
                    }
                }
            }

            chunks.add(text.substring(start, end).trim());
            start = end;
        }

        log.info("Split document into {} chunks", chunks.size());
        return chunks;
    }

    private void validateFile(MultipartFile file) {
        if (file.isEmpty()) {
            throw new IllegalArgumentException("Uploaded file is empty");
        }
        if (file.getSize() > MAX_FILE_SIZE) {
            throw new IllegalArgumentException(
                    "File size (" + (file.getSize() / 1024 / 1024) + " MB) exceeds the 20 MB limit");
        }
        String contentType = file.getContentType();
        String filename = file.getOriginalFilename();
        boolean isPdf = (contentType != null && contentType.equals("application/pdf"))
                || (filename != null && filename.toLowerCase().endsWith(".pdf"));
        if (!isPdf) {
            throw new IllegalArgumentException("Only PDF files are accepted");
        }
    }
}
