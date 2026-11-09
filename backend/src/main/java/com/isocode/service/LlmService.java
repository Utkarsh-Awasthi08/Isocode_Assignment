package com.isocode.service;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.isocode.dto.ClassificationResult;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Optional;

/**
 * Provider-agnostic LLM service using the OpenAI-compatible
 * /v1/chat/completions interface.
 *
 * Works out of the box with:
 *   - Google Gemini  → base-url: https://generativelanguage.googleapis.com/v1beta/openai
 *   - OpenAI         → base-url: https://api.openai.com/v1
 *   - Groq           → base-url: https://api.groq.com/openai/v1
 *   - Together AI    → base-url: https://api.together.xyz/v1
 *   - Mistral        → base-url: https://api.mistral.ai/v1
 *   - OpenRouter     → base-url: https://openrouter.ai/api/v1
 *   - Ollama (local) → base-url: http://localhost:11434/v1  (no key needed)
 *
 * Configure via environment variables or application.yml:
 *   LLM_API_KEY   — your API key (leave blank for Ollama / keyless endpoints)
 *   LLM_BASE_URL  — provider base URL (default: Gemini OpenAI-compat endpoint)
 *   LLM_MODEL     — model name (e.g. gemini-1.5-flash, gpt-4o-mini, llama3-8b-8192)
 */
@Service
@Slf4j
public class LlmService {

    private static final String CATEGORY_LIST =
            "Plumbing, Electrical, Civil, Housekeeping, Lift/Elevator, " +
            "Pest Control, Security, Common Area, Other";

    @Value("${app.llm.api-key:}")
    private String apiKey;

    // Default: Gemini's OpenAI-compatible endpoint (drop-in with any other provider)
    @Value("${app.llm.base-url:https://generativelanguage.googleapis.com/v1beta/openai}")
    private String baseUrl;

    @Value("${app.llm.model:gemini-1.5-flash}")
    private String model;

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(8))
            .build();

    private final ObjectMapper objectMapper = new ObjectMapper()
            .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);

    // ─────────────────────────────────────────────────────────────
    // Public API
    // ─────────────────────────────────────────────────────────────

    /**
     * Classify free-text into category + urgency.
     * Returns empty if the LLM is not configured or the call fails.
     * ComplaintService will apply its own fallback in that case.
     */
    public Optional<ClassificationResult> classify(String complaintText) {
        boolean hasKey = apiKey != null && !apiKey.isBlank();
        boolean isLocalhost = baseUrl != null && (baseUrl.contains("localhost") || baseUrl.contains("127.0.0.1"));

        if (!hasKey && !isLocalhost) {
            log.warn("LLM API key not set (app.llm.api-key) — skipping AI classification");
            return Optional.empty();
        }

        String url = normaliseBaseUrl(baseUrl) + "/chat/completions";
        String body = buildRequestBody(complaintText);

        try {
            HttpRequest.Builder reqBuilder = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(body))
                    .timeout(Duration.ofSeconds(15));

            if (hasKey) {
                reqBuilder.header("Authorization", "Bearer " + apiKey);
            }

            HttpRequest request = reqBuilder.build();
            HttpResponse<String> response =
                    httpClient.send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() != 200) {
                log.error("LLM API HTTP {}: {}", response.statusCode(), truncate(response.body()));
                return Optional.empty();
            }

            return parseResponse(response.body());

        } catch (Exception e) {
            log.error("LLM API call failed ({}): {}", url, e.getMessage());
            return Optional.empty();
        }
    }

    // ─────────────────────────────────────────────────────────────
    // Request Builder — OpenAI /chat/completions format
    // ─────────────────────────────────────────────────────────────

    private String buildRequestBody(String complaintText) {
        String systemMsg = "You are a facility management complaint classifier. "
                + "Respond with ONLY valid JSON — no markdown, no explanation, no extra keys.";

        String userMsg = "Classify this resident complaint:\n\n"
                + "\"" + complaintText + "\"\n\n"
                + "Rules:\n"
                + "- category: exactly one of [" + CATEGORY_LIST + "]\n"
                + "- urgency: exactly one of [LOW, MEDIUM, HIGH]\n"
                + "- summary: ≤10 words\n\n"
                + "Output JSON only:\n"
                + "{\"category\":\"...\",\"urgency\":\"...\",\"summary\":\"...\"}";

        return """
                {
                  "model": "%s",
                  "messages": [
                    {"role": "system", "content": "%s"},
                    {"role": "user",   "content": "%s"}
                  ],
                  "response_format": {"type": "json_object"},
                  "temperature": 0.1,
                  "max_tokens": 200
                }""".formatted(
                        escapeJson(model),
                        escapeJson(systemMsg),
                        escapeJson(userMsg));
    }

    // ─────────────────────────────────────────────────────────────
    // Response Parser — OpenAI choices[0].message.content
    // ─────────────────────────────────────────────────────────────

    private Optional<ClassificationResult> parseResponse(String body) {
        try {
            JsonNode root = objectMapper.readTree(body);
            JsonNode choices = root.path("choices");
            if (choices.isEmpty() || !choices.has(0)) {
                log.error("LLM API response missing 'choices': {}", truncate(body));
                return Optional.empty();
            }

            String text = choices.get(0)
                    .path("message")
                    .path("content").asText();

            text = text.strip();
            // Extract JSON substring between outermost braces if extra text/markdown exists
            int firstBrace = text.indexOf('{');
            int lastBrace = text.lastIndexOf('}');
            if (firstBrace != -1 && lastBrace != -1 && lastBrace >= firstBrace) {
                text = text.substring(firstBrace, lastBrace + 1);
            }

            ClassificationResult result = objectMapper.readValue(text, ClassificationResult.class);

            if (result.category() == null || result.urgency() == null) {
                log.warn("LLM returned incomplete JSON: {}", truncate(text));
                return Optional.empty();
            }

            // Normalise + validate urgency
            String urgency = result.urgency().trim().toUpperCase();
            if (!urgency.equals("LOW") && !urgency.equals("MEDIUM") && !urgency.equals("HIGH")) {
                log.warn("LLM urgency '{}' not recognised — defaulting to MEDIUM", urgency);
                urgency = "MEDIUM";
            }

            return Optional.of(new ClassificationResult(
                    result.category().trim(), urgency, result.summary()));

        } catch (Exception e) {
            log.error("Failed to parse LLM response: {} — body: {}", e.getMessage(), truncate(body));
            return Optional.empty();
        }
    }

    // ─────────────────────────────────────────────────────────────
    // Utilities
    // ─────────────────────────────────────────────────────────────

    private String normaliseBaseUrl(String url) {
        return url == null ? "" : url.stripTrailing().replaceAll("/+$", "");
    }

    private String escapeJson(String s) {
        if (s == null) return "";
        return s.replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("\n", "\\n")
                .replace("\r", "");
    }

    private String truncate(String s) {
        return s == null ? "" : (s.length() > 300 ? s.substring(0, 300) + "…" : s);
    }
}
