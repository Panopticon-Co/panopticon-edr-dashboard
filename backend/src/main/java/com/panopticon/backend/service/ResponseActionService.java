package com.panopticon.backend.service;

import com.panopticon.backend.model.ResponseAction;
import com.panopticon.backend.model.ResponseActionType;
import com.panopticon.backend.model.ResponsePolicyTier;
import com.panopticon.backend.repository.ResponseActionRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
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
        Optional<ResponseAction> existing = responseActionRepository.findById(responseId);
        if (existing.isEmpty() || !"PENDING".equalsIgnoreCase(existing.get().getLifecycleState())) {
            log.warn("Cannot authorize response action {}: not found or not PENDING", responseId);
            return false;
        }

        String actor = (authorizedBy != null && !authorizedBy.isBlank()) ? authorizedBy : "analyst:alice";
        String commandId = "cmd-" + UUID.randomUUID().toString().substring(0, 8);

        forwardToManagerIfAvailable(responseId, "authorize", Map.of());

        boolean ok = responseActionRepository.authorizeAction(responseId, actor, commandId);
        log.info("ResponseAction {} authorized by {}: result={}", responseId, actor, ok);
        return ok;
    }

    public boolean rejectAction(String responseId, String rejectedBy, String reason) {
        Optional<ResponseAction> existing = responseActionRepository.findById(responseId);
        if (existing.isEmpty() || !"PENDING".equalsIgnoreCase(existing.get().getLifecycleState())) {
            log.warn("Cannot reject response action {}: not found or not PENDING", responseId);
            return false;
        }

        if (reason == null || reason.trim().isEmpty() || reason.length() > 512) {
            log.warn("Cannot reject response action {}: reason is invalid", responseId);
            return false;
        }

        String actor = (rejectedBy != null && !rejectedBy.isBlank()) ? rejectedBy : "analyst:alice";
        String r = reason.trim();

        forwardToManagerIfAvailable(responseId, "reject", Map.of("reason", r));

        boolean ok = responseActionRepository.rejectAction(responseId, actor, r);
        log.info("ResponseAction {} rejected by {} (reason: {}): result={}", responseId, actor, r, ok);
        return ok;
    }

    public int runExpirationSweep() {
        Instant cutoff = Instant.now().minus(15, ChronoUnit.MINUTES);
        int expired = responseActionRepository.expireStalePendingActions(cutoff);
        if (expired > 0) {
            log.info("Expiration sweep completed: expired {} stale PENDING actions", expired);
        }
        return expired;
    }

    public boolean submitOrStageAction(ResponseAction action) {
        if (action == null || action.getAction() == null) {
            return false;
        }
        ResponseActionType actionType = ResponseActionType.fromString(action.getAction());
        if (actionType == null) {
            log.warn("Rejected response action with unknown action name: {}", action.getAction());
            return false;
        }

        action.setAction(actionType.getActionName());

        // Target validation
        if (!ResponseAction.validateTarget(actionType, action.getTarget())) {
            log.warn("Rejected response action {} with invalid target schema: {}", action.getAction(), action.getTarget());
            return false;
        }

        // Policy tier assignment
        ResponsePolicyTier requiredTier = ResponsePolicyTier.forAction(actionType);
        if (actionType.isDestructive() || requiredTier == ResponsePolicyTier.ANALYST_APPROVAL) {
            action.setTier(ResponsePolicyTier.ANALYST_APPROVAL.getTierName());
        } else {
            action.setTier(ResponsePolicyTier.AUTO_SAFE.getTierName());
        }

        if (action.getResponseId() == null || action.getResponseId().isBlank()) {
            action.setResponseId("rsp-" + UUID.randomUUID().toString().substring(0, 8));
        }
        if (action.getCreatedAt() == null || action.getCreatedAt().isBlank()) {
            action.setCreatedAt(Instant.now().toString());
        }

        // Duplicate suppression check
        String hostId = null;
        if (action.getTarget() != null && action.getTarget().containsKey("host_id")) {
            hostId = String.valueOf(action.getTarget().get("host_id"));
        }
        Optional<ResponseAction> duplicate = responseActionRepository.findOpenDuplicate(hostId, action.getAction(), action.getTarget());
        if (duplicate.isPresent()) {
            action.setLifecycleState("REJECTED");
            action.setDecidedReason("duplicate of " + duplicate.get().getResponseId());
            action.setAuthorizedBy("system:duplicate-detector");
            log.info("Action {} marked REJECTED as duplicate of open action {}", action.getResponseId(), duplicate.get().getResponseId());
        } else {
            if (ResponsePolicyTier.AUTO_SAFE.getTierName().equals(action.getTier())) {
                action.setLifecycleState("AUTHORIZED");
                action.setCommandId("cmd-" + UUID.randomUUID().toString().substring(0, 8));
                action.setAuthorizedBy("system:auto-safe");
                action.setAuthorizedAt(Instant.now().toString());
            } else {
                action.setLifecycleState("PENDING");
            }
        }

        return responseActionRepository.insertOrIgnore(action);
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
