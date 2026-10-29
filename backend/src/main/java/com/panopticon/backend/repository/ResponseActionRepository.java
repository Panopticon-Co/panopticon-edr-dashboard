package com.panopticon.backend.repository;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.panopticon.backend.model.ResponseAction;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.*;

@Repository
public class ResponseActionRepository {

    private static final Logger log = LoggerFactory.getLogger(ResponseActionRepository.class);

    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;
    private final RowMapper<ResponseAction> rowMapper;

    public ResponseActionRepository(JdbcTemplate jdbcTemplate, ObjectMapper objectMapper) {
        this.jdbcTemplate = jdbcTemplate;
        this.objectMapper = objectMapper;
        this.rowMapper = (rs, rowNum) -> {
            ResponseAction action = new ResponseAction();
            String responseId = rs.getString("response_id");
            action.setResponseId(responseId);
            action.setAlertId(rs.getString("alert_id"));
            action.setAction(rs.getString("action"));
            action.setTier(rs.getString("tier"));
            String state = rs.getString("lifecycle_state");
            action.setLifecycleState(state);
            String commandId = rs.getString("command_id");
            action.setCommandId(commandId);
            action.setCreatedAt(rs.getString("created_at"));
            action.setAuthorizedAt(rs.getString("authorized_at"));
            action.setAuthorizedBy(rs.getString("authorized_by"));
            action.setDecidedReason(rs.getString("decided_reason"));

            String targetJson = rs.getString("target_json");
            if (targetJson != null && !targetJson.isBlank()) {
                try {
                    action.setTarget(objectMapper.readValue(targetJson, new TypeReference<Map<String, Object>>() {}));
                } catch (JsonProcessingException e) {
                    action.setTarget(Collections.emptyMap());
                }
            } else {
                action.setTarget(Collections.emptyMap());
            }

            if (commandId != null && !commandId.isBlank()) {
                if ("SUCCEEDED".equalsIgnoreCase(state)) {
                    action.setCommandState("SUCCEEDED");
                } else if ("FAILED".equalsIgnoreCase(state)) {
                    action.setCommandState("FAILED");
                } else if ("DISPATCHED".equalsIgnoreCase(state) || "AUTHORIZED".equalsIgnoreCase(state)) {
                    action.setCommandState("DISPATCHED");
                }
            }

            action.setAudit(getAuditForResponse(responseId));
            return action;
        };
    }

    public List<ResponseAction> findAll(String state, int limit) {
        int boundedLimit = Math.max(1, Math.min(200, limit));
        if (state != null && !state.isBlank() && !state.equalsIgnoreCase("all")) {
            String sql = "SELECT * FROM response_actions WHERE UPPER(lifecycle_state) = UPPER(?) ORDER BY created_at DESC LIMIT ?";
            return jdbcTemplate.query(sql, rowMapper, state, boundedLimit);
        } else {
            String sql = "SELECT * FROM response_actions ORDER BY created_at DESC LIMIT ?";
            return jdbcTemplate.query(sql, rowMapper, boundedLimit);
        }
    }

    public Optional<ResponseAction> findById(String responseId) {
        String sql = "SELECT * FROM response_actions WHERE response_id = ?";
        List<ResponseAction> list = jdbcTemplate.query(sql, rowMapper, responseId);
        return list.isEmpty() ? Optional.empty() : Optional.of(list.get(0));
    }

    public Optional<ResponseAction> findOpenDuplicate(String hostId, String action, Map<String, Object> target) {
        String sql = "SELECT * FROM response_actions WHERE UPPER(action) = UPPER(?) AND lifecycle_state IN ('PENDING', 'AUTHORIZED', 'DISPATCHED')";
        List<ResponseAction> openActions = jdbcTemplate.query(sql, rowMapper, action);
        for (ResponseAction candidate : openActions) {
            Map<String, Object> candidateTarget = candidate.getTarget() != null ? candidate.getTarget() : Collections.emptyMap();
            // Check host match
            String candidateHost = candidateTarget.get("host_id") != null ? String.valueOf(candidateTarget.get("host_id")) : null;
            if (hostId != null && candidateHost != null && !hostId.equalsIgnoreCase(candidateHost)) {
                continue;
            }
            // Check process match if applicable
            Object candPid = candidateTarget.get("target_pid");
            if (candPid == null) candPid = candidateTarget.get("pid");
            Object reqPid = target != null ? target.get("target_pid") : null;
            if (reqPid == null && target != null) reqPid = target.get("pid");
            if (reqPid != null && candPid != null) {
                if (String.valueOf(reqPid).equals(String.valueOf(candPid))) {
                    return Optional.of(candidate);
                }
            } else if (hostId != null && hostId.equalsIgnoreCase(candidateHost)) {
                return Optional.of(candidate);
            }
        }
        return Optional.empty();
    }

    public boolean insertOrIgnore(ResponseAction action) {
        String sql = "INSERT OR IGNORE INTO response_actions " +
                "(response_id, alert_id, action, tier, lifecycle_state, target_json, command_id, created_at, authorized_at, authorized_by, decided_reason) " +
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";

        String targetJson = "{}";
        try {
            if (action.getTarget() != null) {
                targetJson = objectMapper.writeValueAsString(action.getTarget());
            }
        } catch (Exception ignored) {
        }

        String now = action.getCreatedAt() != null ? action.getCreatedAt() : Instant.now().toString();

        int rows = jdbcTemplate.update(sql,
                action.getResponseId(),
                action.getAlertId(),
                action.getAction(),
                action.getTier() != null ? action.getTier() : "ANALYST_APPROVAL",
                action.getLifecycleState() != null ? action.getLifecycleState() : "PENDING",
                targetJson,
                action.getCommandId(),
                now,
                action.getAuthorizedAt(),
                action.getAuthorizedBy(),
                action.getDecidedReason()
        );

        if (rows > 0 && "REJECTED".equalsIgnoreCase(action.getLifecycleState())) {
            insertAudit(action.getCommandId(), action.getResponseId(), action.getAction(),
                    action.getAuthorizedBy() != null ? action.getAuthorizedBy() : "system:duplicate-detector",
                    "rejected", action.getDecidedReason());
        }

        return rows > 0;
    }

    public boolean authorizeAction(String responseId, String authorizedBy, String commandId) {
        String sql = "UPDATE response_actions SET lifecycle_state = 'AUTHORIZED', authorized_at = ?, authorized_by = ?, command_id = ? " +
                "WHERE response_id = ? AND lifecycle_state = 'PENDING'";
        String now = Instant.now().toString();
        int rows = jdbcTemplate.update(sql, now, authorizedBy, commandId, responseId);
        if (rows > 0) {
            Optional<ResponseAction> opt = findById(responseId);
            String actionName = opt.map(ResponseAction::getAction).orElse("UNKNOWN");
            insertAudit(commandId, responseId, actionName, authorizedBy, "authorized", "Authorized by security analyst");
        }
        return rows > 0;
    }

    public boolean rejectAction(String responseId, String decidedBy, String reason) {
        String sql = "UPDATE response_actions SET lifecycle_state = 'REJECTED', authorized_at = ?, authorized_by = ?, decided_reason = ? " +
                "WHERE response_id = ? AND lifecycle_state = 'PENDING'";
        String now = Instant.now().toString();
        int rows = jdbcTemplate.update(sql, now, decidedBy, reason, responseId);
        if (rows > 0) {
            Optional<ResponseAction> opt = findById(responseId);
            String actionName = opt.map(ResponseAction::getAction).orElse("UNKNOWN");
            insertAudit("none", responseId, actionName, decidedBy, "rejected", reason);
        }
        return rows > 0;
    }

    public int expireStalePendingActions(Instant cutoff) {
        String querySql = "SELECT * FROM response_actions WHERE lifecycle_state = 'PENDING' AND created_at < ?";
        List<ResponseAction> stale = jdbcTemplate.query(querySql, rowMapper, cutoff.toString());
        int count = 0;
        String updateSql = "UPDATE response_actions SET lifecycle_state = 'EXPIRED', decided_reason = '15-minute TTL elapsed without analyst decision' WHERE response_id = ? AND lifecycle_state = 'PENDING'";
        for (ResponseAction a : stale) {
            int rows = jdbcTemplate.update(updateSql, a.getResponseId());
            if (rows > 0) {
                count++;
                insertAudit(a.getCommandId() != null ? a.getCommandId() : "none", a.getResponseId(), a.getAction(),
                        "system:expiration-sweep", "expired", "15-minute TTL elapsed without analyst decision");
            }
        }
        return count;
    }

    public void insertAudit(String commandId, String responseId, String action, String actor, String outcome, String details) {
        String sql = "INSERT INTO command_audit (command_id, response_id, action, actor, timestamp, outcome, details) " +
                "VALUES (?, ?, ?, ?, ?, ?, ?)";
        try {
            jdbcTemplate.update(sql,
                    commandId != null ? commandId : "none",
                    responseId,
                    action != null ? action : "UNKNOWN",
                    actor != null ? actor : "analyst:alice",
                    Instant.now().toString(),
                    outcome,
                    details != null ? details : ""
            );
        } catch (Exception e) {
            log.warn("Failed to insert into command_audit: {}", e.getMessage());
        }
    }

    public List<Map<String, Object>> getAuditForResponse(String responseId) {
        String sql = "SELECT * FROM command_audit WHERE response_id = ? ORDER BY timestamp ASC";
        try {
            return jdbcTemplate.query(sql, (rs, rowNum) -> {
                Map<String, Object> map = new LinkedHashMap<>();
                map.put("audit_id", "aud-" + rs.getLong("audit_id"));
                map.put("command_id", rs.getString("command_id"));
                map.put("event", rs.getString("outcome"));
                map.put("actor", rs.getString("actor"));
                map.put("detail", rs.getString("details"));
                map.put("occurred_at", rs.getString("timestamp"));
                return map;
            }, responseId);
        } catch (Exception e) {
            return Collections.emptyList();
        }
    }

    public long countPending() {
        Long c = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM response_actions WHERE lifecycle_state = 'PENDING'", Long.class);
        return c != null ? c : 0;
    }
}
