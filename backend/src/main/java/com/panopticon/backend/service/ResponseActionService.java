package com.panopticon.backend.service;

import com.panopticon.backend.model.ResponseAction;
import com.panopticon.backend.repository.ResponseActionRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Service
public class ResponseActionService {

    private static final Logger log = LoggerFactory.getLogger(ResponseActionService.class);

    private final ResponseActionRepository responseActionRepository;
    private final RestTemplate restTemplate;

    @Value("${panopticon.manager.url:http://127.0.0.1:8000}")
    private String managerUrl;

    @Value("${panopticon.manager.token:mock-analyst-token}")
    private String managerToken;

    public ResponseActionService(ResponseActionRepository responseActionRepository) {
        this.responseActionRepository = responseActionRepository;
        this.restTemplate = new RestTemplate();
    }

    public List<ResponseAction> listActions(String state, int limit) {
        return responseActionRepository.findAll(state, limit);
    }

    public Optional<ResponseAction> findById(String responseId) {
        return responseActionRepository.findById(responseId);
    }

    public boolean authorizeAction(String responseId, String authorizedBy) {
        String actor = (authorizedBy != null && !authorizedBy.isBlank()) ? authorizedBy : "analyst-1";
        String commandId = "cmd-" + UUID.randomUUID().toString().substring(0, 8);

        // If Panopticon Manager is alive, try to dispatch to manager
        forwardToManagerIfAvailable(responseId, "authorize", Map.of());

        boolean ok = responseActionRepository.authorizeAction(responseId, actor, commandId);
        log.info("ResponseAction {} authorized by {}: result={}", responseId, actor, ok);
        return ok;
    }

    public boolean rejectAction(String responseId, String rejectedBy, String reason) {
        String actor = (rejectedBy != null && !rejectedBy.isBlank()) ? rejectedBy : "analyst-1";
        String r = (reason != null && !reason.isBlank()) ? reason : "Analyst dismissed recommendation";

        forwardToManagerIfAvailable(responseId, "reject", Map.of("reason", r));

        boolean ok = responseActionRepository.rejectAction(responseId, actor, r);
        log.info("ResponseAction {} rejected by {} (reason: {}): result={}", responseId, actor, r, ok);
        return ok;
    }

    private void forwardToManagerIfAvailable(String responseId, String operation, Map<String, Object> payload) {
        try {
            String url = managerUrl.replaceAll("/+$", "") + "/api/v1/response-actions/" + responseId + "/" + operation;
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set("Authorization", "Bearer " + managerToken);
            HttpEntity<Map<String, Object>> request = new HttpEntity<>(payload, headers);
            restTemplate.postForEntity(url, request, String.class);
            log.info("Successfully forwarded {} for {} to Manager", operation, responseId);
        } catch (Exception e) {
            log.debug("Manager forward not completed (offline or mock): {}", e.getMessage());
        }
    }
}
