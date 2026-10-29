package com.panopticon.backend;

import com.panopticon.backend.model.ResponseAction;
import com.panopticon.backend.model.ResponseActionType;
import com.panopticon.backend.model.ResponseLifecycleState;
import com.panopticon.backend.model.ResponsePolicyTier;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

public class ResponseActionEngineTest {

    @Test
    void testCanonicalSevenActionsAllowlist() {
        assertEquals(7, ResponseActionType.values().length);
        assertNotNull(ResponseActionType.fromString("KILL_PROCESS"));
        assertNotNull(ResponseActionType.fromString("COLLECT_PROCESS_INFO"));
        assertNotNull(ResponseActionType.fromString("COLLECT_NETWORK_CONNECTIONS"));
        assertNotNull(ResponseActionType.fromString("COLLECT_FILE"));
        assertNotNull(ResponseActionType.fromString("QUARANTINE_FILE"));
        assertNotNull(ResponseActionType.fromString("ISOLATE_HOST"));
        assertNotNull(ResponseActionType.fromString("RELEASE_HOST_ISOLATION"));

        // Legacy compatibility alias
        assertEquals(ResponseActionType.ISOLATE_HOST, ResponseActionType.fromString("isolate_network"));
        assertEquals(ResponseActionType.KILL_PROCESS, ResponseActionType.fromString("kill_process"));

        // Unknown action rejected
        assertNull(ResponseActionType.fromString("EXECUTE_SHELL"));
        assertNull(ResponseActionType.fromString("BLOCK_FIREWALL_IP"));
        assertFalse(ResponseActionType.isValid("UNKNOWN_ACTION"));
    }

    @Test
    void testDestructiveActionSafeguards() {
        assertTrue(ResponseActionType.KILL_PROCESS.isDestructive());
        assertTrue(ResponseActionType.ISOLATE_HOST.isDestructive());
        assertTrue(ResponseActionType.RELEASE_HOST_ISOLATION.isDestructive());

        assertFalse(ResponseActionType.COLLECT_PROCESS_INFO.isDestructive());
        assertFalse(ResponseActionType.COLLECT_NETWORK_CONNECTIONS.isDestructive());
        assertFalse(ResponseActionType.COLLECT_FILE.isDestructive());
        assertFalse(ResponseActionType.QUARANTINE_FILE.isDestructive());
    }

    @Test
    void testPolicyTierAssignment() {
        // Read-only actions map to AUTO_SAFE
        assertEquals(ResponsePolicyTier.AUTO_SAFE, ResponsePolicyTier.forAction(ResponseActionType.COLLECT_PROCESS_INFO));
        assertEquals(ResponsePolicyTier.AUTO_SAFE, ResponsePolicyTier.forAction(ResponseActionType.COLLECT_NETWORK_CONNECTIONS));

        // Destructive and file actions strictly map to ANALYST_APPROVAL
        assertEquals(ResponsePolicyTier.ANALYST_APPROVAL, ResponsePolicyTier.forAction(ResponseActionType.KILL_PROCESS));
        assertEquals(ResponsePolicyTier.ANALYST_APPROVAL, ResponsePolicyTier.forAction(ResponseActionType.COLLECT_FILE));
        assertEquals(ResponsePolicyTier.ANALYST_APPROVAL, ResponsePolicyTier.forAction(ResponseActionType.QUARANTINE_FILE));
        assertEquals(ResponsePolicyTier.ANALYST_APPROVAL, ResponsePolicyTier.forAction(ResponseActionType.ISOLATE_HOST));
        assertEquals(ResponsePolicyTier.ANALYST_APPROVAL, ResponsePolicyTier.forAction(ResponseActionType.RELEASE_HOST_ISOLATION));
    }

    @Test
    void testTargetSchemaValidation() {
        // Process target validation: requires positive pid and start ticks
        assertTrue(ResponseAction.validateTarget(ResponseActionType.KILL_PROCESS,
                Map.of("target_pid", 1234, "target_start_time_ticks", 5678)));
        assertTrue(ResponseAction.validateTarget(ResponseActionType.COLLECT_PROCESS_INFO,
                Map.of("pid", 100, "start_time_ticks", 200)));

        assertFalse(ResponseAction.validateTarget(ResponseActionType.KILL_PROCESS,
                Map.of("target_pid", 0, "target_start_time_ticks", 5678))); // non-positive pid
        assertFalse(ResponseAction.validateTarget(ResponseActionType.KILL_PROCESS,
                Map.of("target_pid", -5, "target_start_time_ticks", 5678))); // negative pid
        assertFalse(ResponseAction.validateTarget(ResponseActionType.KILL_PROCESS,
                Map.of("target_pid", 1234))); // missing start_time_ticks

        // File target validation: requires non-empty path (1..4096 chars)
        assertTrue(ResponseAction.validateTarget(ResponseActionType.COLLECT_FILE,
                Map.of("path", "/var/log/audit.log")));
        assertTrue(ResponseAction.validateTarget(ResponseActionType.QUARANTINE_FILE,
                Map.of("path", "C:\\Windows\\System32\\bad.dll")));

        assertFalse(ResponseAction.validateTarget(ResponseActionType.COLLECT_FILE,
                Map.of("path", ""))); // empty path
        assertFalse(ResponseAction.validateTarget(ResponseActionType.COLLECT_FILE,
                Map.of("path", "   "))); // whitespace path
        assertFalse(ResponseAction.validateTarget(ResponseActionType.COLLECT_FILE,
                Map.of("path", "a".repeat(4097)))); // > 4096 chars

        // Host target validation: allows empty {} or {host_id: ...}, rejects process/file keys
        assertTrue(ResponseAction.validateTarget(ResponseActionType.ISOLATE_HOST, Map.of()));
        assertTrue(ResponseAction.validateTarget(ResponseActionType.ISOLATE_HOST, Map.of("host_id", "WS-01")));
        assertTrue(ResponseAction.validateTarget(ResponseActionType.RELEASE_HOST_ISOLATION, Map.of()));

        assertFalse(ResponseAction.validateTarget(ResponseActionType.ISOLATE_HOST,
                Map.of("path", "/tmp/file"))); // invalid key for host action
        assertFalse(ResponseAction.validateTarget(ResponseActionType.ISOLATE_HOST,
                Map.of("pid", 1234))); // invalid key for host action
    }

    @Test
    void testCanonicalLifecycleStatesAndTransitions() {
        assertEquals(7, ResponseLifecycleState.values().length);

        assertTrue(ResponseLifecycleState.PENDING.name().equals("PENDING"));
        assertTrue(ResponseLifecycleState.AUTHORIZED.name().equals("AUTHORIZED"));
        assertTrue(ResponseLifecycleState.DISPATCHED.name().equals("DISPATCHED"));
        assertTrue(ResponseLifecycleState.SUCCEEDED.name().equals("SUCCEEDED"));
        assertTrue(ResponseLifecycleState.FAILED.name().equals("FAILED"));
        assertTrue(ResponseLifecycleState.REJECTED.name().equals("REJECTED"));
        assertTrue(ResponseLifecycleState.EXPIRED.name().equals("EXPIRED"));

        // Valid transitions
        assertTrue(ResponseLifecycleState.isValidTransition(ResponseLifecycleState.PENDING, ResponseLifecycleState.AUTHORIZED));
        assertTrue(ResponseLifecycleState.isValidTransition(ResponseLifecycleState.PENDING, ResponseLifecycleState.REJECTED));
        assertTrue(ResponseLifecycleState.isValidTransition(ResponseLifecycleState.PENDING, ResponseLifecycleState.EXPIRED));
        assertTrue(ResponseLifecycleState.isValidTransition(ResponseLifecycleState.AUTHORIZED, ResponseLifecycleState.DISPATCHED));
        assertTrue(ResponseLifecycleState.isValidTransition(ResponseLifecycleState.DISPATCHED, ResponseLifecycleState.SUCCEEDED));
        assertTrue(ResponseLifecycleState.isValidTransition(ResponseLifecycleState.DISPATCHED, ResponseLifecycleState.FAILED));

        // Terminal states cannot transition
        assertTrue(ResponseLifecycleState.SUCCEEDED.isTerminal());
        assertTrue(ResponseLifecycleState.FAILED.isTerminal());
        assertTrue(ResponseLifecycleState.REJECTED.isTerminal());
        assertTrue(ResponseLifecycleState.EXPIRED.isTerminal());

        assertFalse(ResponseLifecycleState.isValidTransition(ResponseLifecycleState.SUCCEEDED, ResponseLifecycleState.AUTHORIZED));
        assertFalse(ResponseLifecycleState.isValidTransition(ResponseLifecycleState.REJECTED, ResponseLifecycleState.AUTHORIZED));
        assertFalse(ResponseLifecycleState.isValidTransition(ResponseLifecycleState.EXPIRED, ResponseLifecycleState.AUTHORIZED));
    }
}
