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
            action.setResponseId(rs.getString("response_id"));
            action.setAlertId(rs.getString("alert_id"));
            action.setAction(rs.getString("action"));
            action.setTier(rs.getString("tier"));
            action.setLifecycleState(rs.getString("lifecycle_state"));
            action.setCommandId(rs.getString("command_id"));
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
        return rows > 0;
    }

    public boolean authorizeAction(String responseId, String authorizedBy, String commandId) {
        String sql = "UPDATE response_actions SET lifecycle_state = 'AUTHORIZED', authorized_at = ?, authorized_by = ?, command_id = ? " +
                "WHERE response_id = ? AND lifecycle_state = 'PENDING'";
        int rows = jdbcTemplate.update(sql, Instant.now().toString(), authorizedBy, commandId, responseId);
        return rows > 0;
    }

    public boolean rejectAction(String responseId, String decidedBy, String reason) {
        String sql = "UPDATE response_actions SET lifecycle_state = 'REJECTED', authorized_at = ?, authorized_by = ?, decided_reason = ? " +
                "WHERE response_id = ? AND lifecycle_state = 'PENDING'";
        int rows = jdbcTemplate.update(sql, Instant.now().toString(), decidedBy, reason, responseId);
        return rows > 0;
    }

    public long countPending() {
        Long c = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM response_actions WHERE lifecycle_state = 'PENDING'", Long.class);
        return c != null ? c : 0;
    }
}
