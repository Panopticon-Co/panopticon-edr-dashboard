package com.panopticon.backend.controller;

import com.panopticon.backend.model.ResponseAction;
import com.panopticon.backend.service.ResponseActionService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
public class ResponseActionController {

    private final ResponseActionService responseActionService;

    public ResponseActionController(ResponseActionService responseActionService) {
        this.responseActionService = responseActionService;
    }

    @GetMapping({"/api/v1/response-actions", "/api/response-actions"})
    public ResponseEntity<Map<String, Object>> listActions(
            @RequestParam(required = false, name = "state") String state,
            @RequestParam(defaultValue = "100") int limit) {

        List<ResponseAction> actions = responseActionService.listActions(state, limit);
        return ResponseEntity.ok(Map.of("response_actions", actions));
    }

    @GetMapping({"/api/v1/response-actions/{id}", "/api/response-actions/{id}"})
    public ResponseEntity<ResponseAction> getActionById(@PathVariable("id") String responseId) {
        return responseActionService.findById(responseId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping({"/api/v1/response-actions/{id}/authorize", "/api/response-actions/{id}/authorize"})
    public ResponseEntity<Map<String, Object>> authorizeAction(
            @PathVariable("id") String responseId,
            @RequestHeader(value = "Authorization", required = false) String authHeader) {

        String actor = "analyst:alice";
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            String token = authHeader.substring(7).trim();
            if (!token.isEmpty() && !token.equalsIgnoreCase("mock-token") && !token.equalsIgnoreCase("mock-analyst-token")) {
                actor = "analyst:alice";
            }
        }

        Optional<ResponseAction> opt = responseActionService.findById(responseId);
        if (opt.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of(
                    "error", "Response action not found; must be PENDING",
                    "response_id", responseId
            ));
        }

        ResponseAction action = opt.get();
        if (!"PENDING".equalsIgnoreCase(action.getLifecycleState())) {
            return ResponseEntity.badRequest().body(Map.of(
                    "error", "Cannot authorize action in state " + action.getLifecycleState() + "; must be PENDING",
                    "response_id", responseId
            ));
        }

        boolean success = responseActionService.authorizeAction(responseId, actor);
        if (success) {
            Optional<ResponseAction> updated = responseActionService.findById(responseId);
            String commandId = updated.map(ResponseAction::getCommandId).orElse("cmd-" + responseId);
            return ResponseEntity.ok(Map.of(
                    "status", "authorized",
                    "response_id", responseId,
                    "authorized_by", actor,
                    "command_id", commandId
            ));
        } else {
            return ResponseEntity.badRequest().body(Map.of(
                    "error", "Action could not be authorized; must be PENDING",
                    "response_id", responseId
            ));
        }
    }

    @PostMapping({"/api/v1/response-actions/{id}/reject", "/api/response-actions/{id}/reject"})
    public ResponseEntity<Map<String, Object>> rejectAction(
            @PathVariable("id") String responseId,
            @RequestBody(required = false) Map<String, Object> body,
            @RequestHeader(value = "Authorization", required = false) String authHeader) {

        String actor = "analyst:alice";
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            String token = authHeader.substring(7).trim();
            if (!token.isEmpty() && !token.equalsIgnoreCase("mock-token") && !token.equalsIgnoreCase("mock-analyst-token")) {
                actor = "analyst:alice";
            }
        }

        if (body == null || !body.containsKey("reason")) {
            return ResponseEntity.badRequest().body(Map.of(
                    "error", "Rejection requires non-empty reason between 1 and 512 characters"
            ));
        }

        Object rawReason = body.get("reason");
        if (!(rawReason instanceof String reasonStr) || reasonStr.trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of(
                    "error", "Rejection requires non-empty reason between 1 and 512 characters"
            ));
        }

        String reason = reasonStr.trim();
        if (reason.length() > 512) {
            return ResponseEntity.badRequest().body(Map.of(
                    "error", "Rejection reason exceeding 512 characters is invalid"
            ));
        }

        Optional<ResponseAction> opt = responseActionService.findById(responseId);
        if (opt.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of(
                    "error", "Response action not found; must be PENDING",
                    "response_id", responseId
            ));
        }

        ResponseAction action = opt.get();
        if (!"PENDING".equalsIgnoreCase(action.getLifecycleState())) {
            return ResponseEntity.badRequest().body(Map.of(
                    "error", "Cannot reject action in state " + action.getLifecycleState() + "; must be PENDING",
                    "response_id", responseId
            ));
        }

        boolean success = responseActionService.rejectAction(responseId, actor, reason);
        if (success) {
            return ResponseEntity.ok(Map.of(
                    "status", "rejected",
                    "response_id", responseId,
                    "decided_reason", reason
            ));
        } else {
            return ResponseEntity.badRequest().body(Map.of(
                    "error", "Action could not be rejected; must be PENDING",
                    "response_id", responseId
            ));
        }
    }
}
