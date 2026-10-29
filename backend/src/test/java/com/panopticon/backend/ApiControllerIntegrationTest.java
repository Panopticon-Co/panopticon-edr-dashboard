package com.panopticon.backend;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.panopticon.backend.model.AlertRecord;
import com.panopticon.backend.model.ResponseAction;
import com.panopticon.backend.repository.AlertRepository;
import com.panopticon.backend.repository.ResponseActionRepository;
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
    void testTelemetryFluctuationsEndpoint() throws Exception {
        mockMvc.perform(get("/api/v1/telemetry/fluctuations"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.climatological_average", hasSize(365)))
                .andExpect(jsonPath("$.historical_baselines", aMapWithSize(31)))
                .andExpect(jsonPath("$.operational_cohorts", aMapWithSize(5)))
                .andExpect(jsonPath("$.active_telemetry", not(empty())))
                .andExpect(jsonPath("$.incident_callouts", not(empty())));
    }
}
