package com.panopticon.backend.repository;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.panopticon.backend.model.AlertRecord;
import com.panopticon.backend.model.EndpointAsset;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.util.*;

@Repository
public class AlertRepository {

    private static final Logger log = LoggerFactory.getLogger(AlertRepository.class);

    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;
    private final RowMapper<AlertRecord> alertRowMapper;

    public AlertRepository(JdbcTemplate jdbcTemplate, ObjectMapper objectMapper) {
        this.jdbcTemplate = jdbcTemplate;
        this.objectMapper = objectMapper;
        this.alertRowMapper = (rs, rowNum) -> {
            AlertRecord alert = new AlertRecord();
            alert.setAlertId(rs.getString("alert_id"));
            alert.setRuleId(rs.getString("rule_id"));
            alert.setTitle(rs.getString("title"));
            alert.setSeverity(rs.getString("severity"));
            alert.setLevel(rs.getInt("level"));
            alert.setHostId(rs.getString("host_id"));
            alert.setAgentId(rs.getString("agent_id"));
            alert.setTimestamp(rs.getString("alert_timestamp"));
            alert.setMitreTactic(rs.getString("mitre_tactic"));
            alert.setMitreTechnique(rs.getString("mitre_technique"));

            String evidenceJson = rs.getString("evidence_json");
            if (evidenceJson != null && !evidenceJson.isBlank()) {
                try {
                    alert.setEvidence(objectMapper.readValue(evidenceJson, new TypeReference<Map<String, Object>>() {}));
                } catch (JsonProcessingException e) {
                    alert.setEvidence(Collections.emptyMap());
                }
            }

            String alertJson = rs.getString("alert_json");
            if (alertJson != null && !alertJson.isBlank()) {
                try {
                    Map<String, Object> full = objectMapper.readValue(alertJson, new TypeReference<Map<String, Object>>() {});
                    if (full.containsKey("active_response") && full.get("active_response") instanceof Map) {
                        @SuppressWarnings("unchecked")
                        Map<String, Object> ar = (Map<String, Object>) full.get("active_response");
                        alert.setActiveResponse(ar);
                    }
                } catch (Exception ignored) {
                }
            }
            return alert;
        };
    }

    public Optional<AlertRecord> findById(String alertId) {
        String sql = "SELECT * FROM alerts WHERE alert_id = ?";
        List<AlertRecord> list = jdbcTemplate.query(sql, alertRowMapper, alertId);
        return list.isEmpty() ? Optional.empty() : Optional.of(list.get(0));
    }

    public List<AlertRecord> findAll(String hostId, String severity, String search, int limit, int offset) {
        StringBuilder sql = new StringBuilder("SELECT * FROM alerts WHERE 1=1 ");
        List<Object> params = new ArrayList<>();

        if (hostId != null && !hostId.isBlank()) {
            sql.append("AND host_id = ? ");
            params.add(hostId);
        }
        if (severity != null && !severity.isBlank() && !severity.equalsIgnoreCase("all")) {
            sql.append("AND LOWER(severity) = LOWER(?) ");
            params.add(severity);
        }
        if (search != null && !search.isBlank()) {
            sql.append("AND (LOWER(title) LIKE LOWER(?) OR LOWER(rule_id) LIKE LOWER(?) OR LOWER(mitre_tactic) LIKE LOWER(?) OR LOWER(evidence_json) LIKE LOWER(?)) ");
            String q = "%" + search + "%";
            params.add(q);
            params.add(q);
            params.add(q);
            params.add(q);
        }

        sql.append("ORDER BY created_at DESC, alert_id DESC LIMIT ? OFFSET ?");
        params.add(Math.max(1, Math.min(500, limit)));
        params.add(Math.max(0, offset));

        return jdbcTemplate.query(sql.toString(), alertRowMapper, params.toArray());
    }

    public boolean insertOrIgnore(AlertRecord alert) {
        String sql = "INSERT OR IGNORE INTO alerts (alert_id, rule_id, title, level, severity, host_id, agent_id, event_id, " +
                "alert_timestamp, created_at, mitre_tactic, mitre_technique, evidence_json, alert_json) " +
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";

        String evidenceJson = "{}";
        try {
            evidenceJson = objectMapper.writeValueAsString(alert.getEvidence());
        } catch (Exception ignored) {
        }

        String alertJson = "{}";
        try {
            alertJson = objectMapper.writeValueAsString(alert);
        } catch (Exception ignored) {
        }

        String now = alert.getTimestamp() != null ? alert.getTimestamp() : Instant.now().toString();

        int rows = jdbcTemplate.update(sql,
                alert.getAlertId(),
                alert.getRuleId(),
                alert.getTitle(),
                alert.getLevel() != null ? alert.getLevel() : 0,
                alert.getSeverity(),
                alert.getHostId(),
                alert.getAgentId(),
                alert.getAlertId(),
                alert.getTimestamp(),
                now,
                alert.getMitreTactic(),
                alert.getMitreTechnique(),
                evidenceJson,
                alertJson
        );
        return rows > 0;
    }

    public long count() {
        Long c = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM alerts", Long.class);
        return c != null ? c : 0;
    }

    public Map<String, Long> countBySeverity() {
        String sql = "SELECT LOWER(severity) as sev, COUNT(*) as cnt FROM alerts GROUP BY LOWER(severity)";
        Map<String, Long> map = new HashMap<>();
        jdbcTemplate.query(sql, rs -> {
            String s = rs.getString("sev");
            long count = rs.getLong("cnt");
            if (s != null) map.put(s, count);
        });
        return map;
    }

    public long countDistinctHosts() {
        Long c = jdbcTemplate.queryForObject("SELECT COUNT(DISTINCT host_id) FROM alerts WHERE host_id IS NOT NULL AND host_id != ''", Long.class);
        return c != null ? c : 0;
    }

    public List<EndpointAsset> getImpactedEndpoints() {
        String sql = "SELECT host_id, " +
                "COUNT(*) as total, " +
                "SUM(CASE WHEN LOWER(severity) = 'critical' THEN 1 ELSE 0 END) as crit_cnt, " +
                "SUM(CASE WHEN LOWER(severity) = 'high' THEN 1 ELSE 0 END) as high_cnt, " +
                "MAX(created_at) as last_seen " +
                "FROM alerts WHERE host_id IS NOT NULL AND host_id != '' " +
                "GROUP BY host_id ORDER BY crit_cnt DESC, high_cnt DESC, total DESC LIMIT 50";

        return jdbcTemplate.query(sql, (rs, rowNum) -> {
            EndpointAsset ep = new EndpointAsset();
            String host = rs.getString("host_id");
            ep.setHostId(host);
            ep.setHostname(host);
            ep.setTotalAlerts(rs.getInt("total"));
            ep.setCriticalAlerts(rs.getInt("crit_cnt"));
            ep.setHighAlerts(rs.getInt("high_cnt"));
            ep.setLastSeen(rs.getString("last_seen"));

            // Determine role and OS from hostname
            String hLower = host.toLowerCase();
            if (hLower.contains("dc") || hLower.contains("domain")) {
                ep.setRole("Domain Controller");
                ep.setOsType("windows");
                ep.setIpAddress("10.0.1.10");
            } else if (hLower.contains("srv") || hLower.contains("prod") || hLower.contains("db")) {
                ep.setRole("Production Server");
                ep.setOsType(hLower.contains("lin") || hLower.contains("deb") || hLower.contains("ub") ? "linux" : "windows");
                ep.setIpAddress("10.0.2.45");
            } else {
                ep.setRole("Corporate Workstation");
                ep.setOsType(hLower.contains("lin") ? "linux" : "windows");
                ep.setIpAddress("192.168.1.105");
            }
            return ep;
        });
    }
}
