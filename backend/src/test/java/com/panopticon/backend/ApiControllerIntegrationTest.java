package com.panopticon.backend;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.panopticon.backend.model.AlertRecord;
import com.panopticon.backend.model.ResponseAction;
import com.panopticon.backend.repository.AlertRepository;
import com.panopticon.backend.repository.ResponseActionRepository;
import com.panopticon.backend.service.ResponseActionService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Map;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
public class ApiControllerIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private AlertRepository alertRepository;

    @Autowired
    private ResponseActionRepository responseActionRepository;

    @Autowired
    private ResponseActionService responseActionService;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private ObjectMapper objectMapper;

    @BeforeEach
    void cleanDb() {
        jdbcTemplate.execute("DELETE FROM alerts");
        jdbcTemplate.execute("DELETE FROM response_actions");
    }

    @Test
    void testHealthEndpoint() throws Exception {
        mockMvc.perform(get("/api/v1/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status", is("healthy")))
                .andExpect(jsonPath("$.service", is("panopticon-backend-service")));

        mockMvc.perform(get("/healthz"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status", is("healthy")));
    }

    @Test
    void testAlertsAndStatsEndpoints() throws Exception {
        AlertRecord alert = new AlertRecord();
        alert.setAlertId("ALT-MOCK-001");
        alert.setRuleId("panopticon.mimikatz");
        alert.setTitle("Credential Dumping Attempt");
        alert.setSeverity("critical");
        alert.setHostId("FIN-SRV-01");
        alert.setTimestamp("2026-10-22T12:00:00Z");
        alertRepository.insertOrIgnore(alert);

        // Test GET /api/v1/alerts
        mockMvc.perform(get("/api/v1/alerts"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].alert_id", is("ALT-MOCK-001")))
                .andExpect(jsonPath("$[0].severity", is("critical")));

        // Test GET /api/alerts (console v1 alias)
        mockMvc.perform(get("/api/alerts"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)));

        // Test GET /api/v1/alerts/{id}
        mockMvc.perform(get("/api/v1/alerts/ALT-MOCK-001"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title", is("Credential Dumping Attempt")));

        // Test GET /api/v1/dashboard/stats
        mockMvc.perform(get("/api/v1/dashboard/stats"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total", is(1)))
                .andExpect(jsonPath("$.critical", is(1)))
                .andExpect(jsonPath("$.hosts_alerting", is(1)));

        // Test GET /api/stats (console v1 alias)
        mockMvc.perform(get("/api/stats"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total", is(1)));
    }

    @Test
    void testResponseActionsEndpoints() throws Exception {
        ResponseAction action = new ResponseAction();
        action.setResponseId("rsp-test-01");
        action.setAlertId("ALT-MOCK-001");
        action.setAction("isolate_network");
        action.setTier("ANALYST_APPROVAL");
        action.setLifecycleState("PENDING");
        action.setTarget(Map.of("host_id", "FIN-SRV-01"));
        responseActionRepository.insertOrIgnore(action);

        // Test GET /api/v1/response-actions
        mockMvc.perform(get("/api/v1/response-actions"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.response_actions", hasSize(1)))
                .andExpect(jsonPath("$.response_actions[0].response_id", is("rsp-test-01")))
                .andExpect(jsonPath("$.response_actions[0].action", is("isolate_network")));

        // Test GET /api/response-actions (console v1 alias)
        mockMvc.perform(get("/api/response-actions"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.response_actions", hasSize(1)));

        // Test POST /api/v1/response-actions/{id}/authorize
        mockMvc.perform(post("/api/v1/response-actions/rsp-test-01/authorize")
                        .header("Authorization", "Bearer mock-token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status", is("authorized")))
                .andExpect(jsonPath("$.response_id", is("rsp-test-01")));

        // Verify state is now AUTHORIZED
        ResponseAction updated = responseActionRepository.findById("rsp-test-01").orElseThrow();
        org.junit.jupiter.api.Assertions.assertEquals("AUTHORIZED", updated.getLifecycleState());
    }

    @Test
    void testResponseActionRejectValidationAndAudit() throws Exception {
        ResponseAction action = new ResponseAction();
        action.setResponseId("rsp-test-rej");
        action.setAlertId("ALT-MOCK-002");
        action.setAction("QUARANTINE_FILE");
        action.setTier("ANALYST_APPROVAL");
        action.setLifecycleState("PENDING");
        action.setTarget(Map.of("path", "/tmp/bad.exe"));
        responseActionRepository.insertOrIgnore(action);

        // Reject with empty reason -> 400
        mockMvc.perform(post("/api/v1/response-actions/rsp-test-rej/reject")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\":\"\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error", containsString("non-empty reason")));

        // Reject with whitespace reason -> 400
        mockMvc.perform(post("/api/v1/response-actions/rsp-test-rej/reject")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\":\"   \"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error", containsString("non-empty reason")));

        // Reject with overlong reason (> 512 chars) -> 400
        String overlong = "R".repeat(513);
        mockMvc.perform(post("/api/v1/response-actions/rsp-test-rej/reject")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\":\"" + overlong + "\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error", containsString("512")));

        // Reject with valid reason -> 200
        mockMvc.perform(post("/api/v1/response-actions/rsp-test-rej/reject")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\":\"Analyst verified benign binary\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status", is("rejected")))
                .andExpect(jsonPath("$.decided_reason", is("Analyst verified benign binary")));

        ResponseAction updated = responseActionRepository.findById("rsp-test-rej").orElseThrow();
        org.junit.jupiter.api.Assertions.assertEquals("REJECTED", updated.getLifecycleState());
        org.junit.jupiter.api.Assertions.assertEquals("Analyst verified benign binary", updated.getDecidedReason());
    }

    @Test
    void testDoubleAuthorizeCasFailure() throws Exception {
        ResponseAction action = new ResponseAction();
        action.setResponseId("rsp-test-cas");
        action.setAlertId("ALT-MOCK-003");
        action.setAction("KILL_PROCESS");
        action.setTier("ANALYST_APPROVAL");
        action.setLifecycleState("PENDING");
        action.setTarget(Map.of("target_pid", 100, "target_start_time_ticks", 200));
        responseActionRepository.insertOrIgnore(action);

        // First authorize -> OK
        mockMvc.perform(post("/api/response-actions/rsp-test-cas/authorize"))
                .andExpect(status().isOk());

        // Second authorize -> 400 (CAS check failure, no longer PENDING)
        mockMvc.perform(post("/api/response-actions/rsp-test-cas/authorize"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error", containsString("must be PENDING")));
    }

    @Test
    void testExpirationSweepAndDuplicateSuppression() {
        // Test duplicate suppression via service
        ResponseAction action1 = new ResponseAction();
        action1.setResponseId("rsp-dup-1");
        action1.setAlertId("ALT-DUP-1");
        action1.setAction("ISOLATE_HOST");
        action1.setTarget(Map.of("host_id", "WS-DUP-HOST"));
        boolean staged1 = responseActionService.submitOrStageAction(action1);
        org.junit.jupiter.api.Assertions.assertTrue(staged1);
        org.junit.jupiter.api.Assertions.assertEquals("PENDING", action1.getLifecycleState());

        // Second action for same host and action -> marked REJECTED as duplicate
        ResponseAction action2 = new ResponseAction();
        action2.setResponseId("rsp-dup-2");
        action2.setAlertId("ALT-DUP-2");
        action2.setAction("ISOLATE_HOST");
        action2.setTarget(Map.of("host_id", "WS-DUP-HOST"));
        boolean staged2 = responseActionService.submitOrStageAction(action2);
        org.junit.jupiter.api.Assertions.assertTrue(staged2);
        org.junit.jupiter.api.Assertions.assertEquals("REJECTED", action2.getLifecycleState());
        org.junit.jupiter.api.Assertions.assertTrue(action2.getDecidedReason().contains("duplicate of rsp-dup-1"));

        // Test 15-minute expiration sweep
        ResponseAction staleAction = new ResponseAction();
        staleAction.setResponseId("rsp-stale-1");
        staleAction.setAlertId("ALT-STALE-1");
        staleAction.setAction("KILL_PROCESS");
        staleAction.setTier("ANALYST_APPROVAL");
        staleAction.setLifecycleState("PENDING");
        staleAction.setCreatedAt(java.time.Instant.now().minus(20, java.time.temporal.ChronoUnit.MINUTES).toString());
        staleAction.setTarget(Map.of("target_pid", 999, "target_start_time_ticks", 888));
        responseActionRepository.insertOrIgnore(staleAction);

        int expired = responseActionService.runExpirationSweep();
        org.junit.jupiter.api.Assertions.assertTrue(expired >= 1);

        ResponseAction fetchedStale = responseActionRepository.findById("rsp-stale-1").orElseThrow();
        org.junit.jupiter.api.Assertions.assertEquals("EXPIRED", fetchedStale.getLifecycleState());
    }
}
