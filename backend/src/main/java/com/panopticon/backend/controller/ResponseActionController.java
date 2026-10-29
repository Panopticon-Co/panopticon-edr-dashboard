package com.panopticon.backend.controller;

import com.panopticon.backend.model.ResponseAction;
import com.panopticon.backend.service.ResponseActionService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

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

    @GetMapping("/api/v1/response-actions/{id}")
    public ResponseEntity<ResponseAction> getActionById(@PathVariable("id") String responseId) {
        return responseActionService.findById(responseId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/api/v1/response-actions/{id}/authorize")
    public ResponseEntity<Map<String, Object>> authorizeAction(
            @PathVariable("id") String responseId,
            @RequestHeader(value = "Authorization", required = false) String authHeader) {

        String actor = "analyst-1";
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            actor = "analyst-token";
        }

        boolean success = responseActionService.authorizeAction(responseId, actor);
        if (success) {
            return ResponseEntity.ok(Map.of(
                    "status", "authorized",
                    "response_id", responseId,
                    "authorized_by", actor
            ));
        } else {
            return ResponseEntity.badRequest().body(Map.of(
                    "error", "Action could not be authorized or was not in PENDING state",
                    "response_id", responseId
            ));
        }
    }

    @PostMapping("/api/v1/response-actions/{id}/reject")
    public ResponseEntity<Map<String, Object>> rejectAction(
            @PathVariable("id") String responseId,
            @RequestBody(required = false) Map<String, String> body,
            @RequestHeader(value = "Authorization", required = false) String authHeader) {

        String actor = "analyst-1";
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            actor = "analyst-token";
        }

        String reason = (body != null && body.containsKey("reason")) ? body.get("reason") : "Analyst dismissed";
        boolean success = responseActionService.rejectAction(responseId, actor, reason);

        if (success) {
            return ResponseEntity.ok(Map.of(
                    "status", "rejected",
                    "response_id", responseId,
                    "decided_reason", reason
            ));
        } else {
            return ResponseEntity.badRequest().body(Map.of(
                    "error", "Action could not be rejected or was not in PENDING state",
                    "response_id", responseId
            ));
        }
    }
}
