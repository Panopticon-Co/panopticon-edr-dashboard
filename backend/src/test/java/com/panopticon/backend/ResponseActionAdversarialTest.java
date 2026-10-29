package com.panopticon.backend;

import com.panopticon.backend.model.ResponseAction;
import com.panopticon.backend.model.ResponseActionType;
import com.panopticon.backend.model.ResponseLifecycleState;
import com.panopticon.backend.model.ResponsePolicyTier;
import com.panopticon.backend.repository.ResponseActionRepository;
import com.panopticon.backend.service.ResponseActionService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Collections;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
public class ResponseActionAdversarialTest {

    @Autowired
    private ResponseActionService responseActionService;

    @Autowired
    private ResponseActionRepository responseActionRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @BeforeEach
    void setup() {
        jdbcTemplate.execute("DELETE FROM command_audit");
        jdbcTemplate.execute("DELETE FROM response_actions");
    }

    // -------------------------------------------------------------
    // CHALLENGE 1: Action Vocabulary & Policy Constraints
    // -------------------------------------------------------------

    @Test
    @DisplayName("Challenge 1.1: Invalid action strings must be rejected")
    void challengeInvalidActionStrings() {
        String[] invalidActions = {
                "EXECUTE_SHELL",
                "RUN_COMMAND",
                "FORMAT_DISK",
                "SHUTDOWN",
                "DROP_DATABASE",
                "SPAWN_PROCESS",
                "",
                "   ",
                null,
                "KILL_PROCESS_FORCE",
                "isolate",
                "12345",
                "!@#$%^&*"
        };

        for (String invalid : invalidActions) {
            ResponseActionType parsed = ResponseActionType.fromString(invalid);
            assertNull(parsed, "Expected null for invalid action: " + invalid);
            assertFalse(ResponseActionType.isValid(invalid), "Expected isValid=false for: " + invalid);

            ResponseAction action = new ResponseAction();
            action.setAlertId("ALT-TEST");
            action.setAction(invalid);
            action.setTarget(Map.of("host_id", "H1"));
            boolean submitted = responseActionService.submitOrStageAction(action);
            assertFalse(submitted, "submitOrStageAction must reject invalid action string: " + invalid);
        }
    }

    @Test
    @DisplayName("Challenge 1.2: Destructive actions CANNOT bypass ANALYST_APPROVAL even if caller requests AUTO_SAFE")
    void challengeDestructiveActionsCannotBypassApproval() {
        ResponseActionType[] destructive = {
                ResponseActionType.KILL_PROCESS,
                ResponseActionType.ISOLATE_HOST,
                ResponseActionType.RELEASE_HOST_ISOLATION
        };

        for (ResponseActionType actType : destructive) {
            assertTrue(actType.isDestructive(), actType.name() + " must be marked destructive");
            assertEquals(ResponsePolicyTier.ANALYST_APPROVAL, ResponsePolicyTier.forAction(actType),
                    actType.name() + " policy tier must strictly be ANALYST_APPROVAL");

            // Attempt adversarial bypass: caller passes tier="AUTO_SAFE" and lifecycle_state="AUTHORIZED"
            ResponseAction adversarial = new ResponseAction();
            adversarial.setResponseId("adv-" + actType.name().toLowerCase());
            adversarial.setAlertId("ALT-ADV-001");
            adversarial.setAction(actType.getActionName());
            adversarial.setTier("AUTO_SAFE");
            adversarial.setLifecycleState("AUTHORIZED");

            Map<String, Object> target = actType.isProcessAction()
                    ? Map.of("target_pid", 100, "target_start_time_ticks", 200)
                    : Map.of("host_id", "HOST-ADV");
            adversarial.setTarget(target);

            boolean submitted = responseActionService.submitOrStageAction(adversarial);
            assertTrue(submitted, "Valid submission should succeed");

            // Verify the service forced tier to ANALYST_APPROVAL and lifecycle_state to PENDING
            assertEquals(ResponsePolicyTier.ANALYST_APPROVAL.getTierName(), adversarial.getTier(),
                    "Service must override caller tier to ANALYST_APPROVAL for destructive action " + actType);
            assertEquals(ResponseLifecycleState.PENDING.getStateName(), adversarial.getLifecycleState(),
                    "Service must force PENDING state for destructive action " + actType);

            ResponseAction persisted = responseActionRepository.findById(adversarial.getResponseId()).orElseThrow();
            assertEquals("ANALYST_APPROVAL", persisted.getTier());
            assertEquals("PENDING", persisted.getLifecycleState());
        }
    }

    @Test
    @DisplayName("Challenge 1.3: Process target validation fails on non-positive pid or ticks, missing fields, or invalid types")
    void challengeProcessTargetValidation() {
        ResponseActionType act = ResponseActionType.KILL_PROCESS;

        // Valid positive
        assertTrue(ResponseAction.validateTarget(act, Map.of("target_pid", 1, "target_start_time_ticks", 1)));
        assertTrue(ResponseAction.validateTarget(act, Map.of("pid", 9999, "start_time_ticks", 8888)));

        // Non-positive PID (zero, negative)
        assertFalse(ResponseAction.validateTarget(act, Map.of("target_pid", 0, "target_start_time_ticks", 100)));
        assertFalse(ResponseAction.validateTarget(act, Map.of("target_pid", -1, "target_start_time_ticks", 100)));
        assertFalse(ResponseAction.validateTarget(act, Map.of("pid", 0, "start_time_ticks", 100)));
        assertFalse(ResponseAction.validateTarget(act, Map.of("pid", -9999, "start_time_ticks", 100)));

        // Non-positive ticks (zero, negative)
        assertFalse(ResponseAction.validateTarget(act, Map.of("target_pid", 100, "target_start_time_ticks", 0)));
        assertFalse(ResponseAction.validateTarget(act, Map.of("target_pid", 100, "target_start_time_ticks", -1)));
        assertFalse(ResponseAction.validateTarget(act, Map.of("pid", 100, "start_time_ticks", 0)));
        assertFalse(ResponseAction.validateTarget(act, Map.of("pid", 100, "start_time_ticks", -500)));

        // Missing fields
        assertFalse(ResponseAction.validateTarget(act, null));
        assertFalse(ResponseAction.validateTarget(act, Collections.emptyMap()));
        assertFalse(ResponseAction.validateTarget(act, Map.of("target_pid", 100)));
        assertFalse(ResponseAction.validateTarget(act, Map.of("target_start_time_ticks", 100)));

        // Malformed non-numeric types
        assertFalse(ResponseAction.validateTarget(act, Map.of("target_pid", "not_a_number", "target_start_time_ticks", 100)));
        assertFalse(ResponseAction.validateTarget(act, Map.of("target_pid", 100, "target_start_time_ticks", "not_a_number")));
    }

    // -------------------------------------------------------------
    // CHALLENGE 2: Duplicate Suppression
    // -------------------------------------------------------------

    @Test
    @DisplayName("Challenge 2.1: Open duplicates for same host and action are recorded as REJECTED")
    void challengeDuplicateSuppressionForHostActions() {
        ResponseAction action1 = new ResponseAction();
        action1.setResponseId("dup-orig-01");
        action1.setAlertId("ALT-DUP-1");
        action1.setAction("ISOLATE_HOST");
        action1.setTarget(Map.of("host_id", "SRV-TEST-DUP"));

        boolean staged1 = responseActionService.submitOrStageAction(action1);
        assertTrue(staged1);
        assertEquals("PENDING", action1.getLifecycleState());

        // Second action for same host and action while first is PENDING
        ResponseAction action2 = new ResponseAction();
        action2.setResponseId("dup-copy-01");
        action2.setAlertId("ALT-DUP-2");
        action2.setAction("ISOLATE_HOST");
        action2.setTarget(Map.of("host_id", "SRV-TEST-DUP"));

        boolean staged2 = responseActionService.submitOrStageAction(action2);
        assertTrue(staged2);
        assertEquals("REJECTED", action2.getLifecycleState());
        assertTrue(action2.getDecidedReason().contains("duplicate of dup-orig-01"));

        // Third action while first is AUTHORIZED
        responseActionService.authorizeAction("dup-orig-01", "analyst:bob");

        ResponseAction action3 = new ResponseAction();
        action3.setResponseId("dup-copy-02");
        action3.setAlertId("ALT-DUP-3");
        action3.setAction("ISOLATE_HOST");
        action3.setTarget(Map.of("host_id", "SRV-TEST-DUP"));

        boolean staged3 = responseActionService.submitOrStageAction(action3);
        assertTrue(staged3);
        assertEquals("REJECTED", action3.getLifecycleState());
        assertTrue(action3.getDecidedReason().contains("duplicate of dup-orig-01"));

        // Different host -> NOT duplicate
        ResponseAction actionDiffHost = new ResponseAction();
        actionDiffHost.setResponseId("diff-host-01");
        actionDiffHost.setAlertId("ALT-DIFF-1");
        actionDiffHost.setAction("ISOLATE_HOST");
        actionDiffHost.setTarget(Map.of("host_id", "SRV-OTHER-HOST"));

        boolean stagedDiff = responseActionService.submitOrStageAction(actionDiffHost);
        assertTrue(stagedDiff);
        assertEquals("PENDING", actionDiffHost.getLifecycleState());
    }

    @Test
    @DisplayName("Challenge 2.2: Process actions duplicate suppression by PID and host")
    void challengeDuplicateSuppressionForProcessActions() {
        ResponseAction act1 = new ResponseAction();
        act1.setResponseId("proc-act-01");
        act1.setAlertId("ALT-PROC-1");
        act1.setAction("KILL_PROCESS");
        act1.setTarget(Map.of("host_id", "WS-HOST-1", "target_pid", 4444, "target_start_time_ticks", 1111));

        assertTrue(responseActionService.submitOrStageAction(act1));
        assertEquals("PENDING", act1.getLifecycleState());

        // Duplicate submission with same PID
        ResponseAction actDup = new ResponseAction();
        actDup.setResponseId("proc-act-dup");
        actDup.setAlertId("ALT-PROC-2");
        actDup.setAction("KILL_PROCESS");
        actDup.setTarget(Map.of("host_id", "WS-HOST-1", "target_pid", 4444, "target_start_time_ticks", 1111));

        assertTrue(responseActionService.submitOrStageAction(actDup));
        assertEquals("REJECTED", actDup.getLifecycleState());
        assertTrue(actDup.getDecidedReason().contains("duplicate of proc-act-01"));

        // Same host but different PID -> NOT a duplicate
        ResponseAction actDiffPid = new ResponseAction();
        actDiffPid.setResponseId("proc-act-diff-pid");
        actDiffPid.setAlertId("ALT-PROC-3");
        actDiffPid.setAction("KILL_PROCESS");
        actDiffPid.setTarget(Map.of("host_id", "WS-HOST-1", "target_pid", 7777, "target_start_time_ticks", 2222));

        assertTrue(responseActionService.submitOrStageAction(actDiffPid));
        assertEquals("PENDING", actDiffPid.getLifecycleState());
    }
}
