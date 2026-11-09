package com.isocode.service;

import com.isocode.dto.ClassificationResult;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.Optional;

/**
 * Service for Gemini AI integration.
 * Delegates to {@link LlmService}, which provides an OpenAI-compatible interface
 * supporting Google Gemini, OpenAI, Groq, Mistral, Ollama, and any other provider.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class GeminiService {

    private final LlmService llmService;

    public Optional<ClassificationResult> classify(String complaintText) {
        log.debug("GeminiService delegating classify request to LlmService");
        return llmService.classify(complaintText);
    }
}
