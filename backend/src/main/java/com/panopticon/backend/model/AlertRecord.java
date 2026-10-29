package com.panopticon.backend.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.Collections;
import java.util.Map;

@JsonIgnoreProperties(ignoreUnknown = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
public class AlertRecord {

    @JsonProperty("alert_id")
    private String alertId;

    @JsonProperty("rule_id")
    private String ruleId;

    @JsonProperty("title")
    private String title;

    @JsonProperty("severity")
    private String severity;

    @JsonProperty("level")
    private Integer level;

    @JsonProperty("timestamp")
    private String timestamp;

    @JsonProperty("mitre_tactic")
    private String mitreTactic;

    @JsonProperty("mitre_technique")
    private String mitreTechnique;

    @JsonProperty("evidence")
    private Map<String, Object> evidence;

    @JsonProperty("active_response")
    private Map<String, Object> activeResponse;

    @JsonProperty("host_id")
    private String hostId;

    @JsonProperty("agent_id")
    private String agentId;

    public AlertRecord() {
    }

    public AlertRecord(String alertId, String ruleId, String title, String severity, Integer level, String timestamp) {
        this.alertId = alertId;
        this.ruleId = ruleId;
        this.title = title;
        this.severity = severity;
        this.level = level;
        this.timestamp = timestamp;
    }

    public String getAlertId() {
        return alertId;
    }

    public void setAlertId(String alertId) {
        this.alertId = alertId;
    }

    public String getRuleId() {
        return ruleId;
    }

    public void setRuleId(String ruleId) {
        this.ruleId = ruleId;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getSeverity() {
        return severity;
    }

    public void setSeverity(String severity) {
        this.severity = severity;
    }

    public Integer getLevel() {
        return level;
    }

    public void setLevel(Integer level) {
        this.level = level;
    }

    public String getTimestamp() {
        return timestamp;
    }

    public void setTimestamp(String timestamp) {
        this.timestamp = timestamp;
    }

    public String getMitreTactic() {
        return mitreTactic;
    }

    public void setMitreTactic(String mitreTactic) {
        this.mitreTactic = mitreTactic;
    }

    public String getMitreTechnique() {
        return mitreTechnique;
    }

    public void setMitreTechnique(String mitreTechnique) {
        this.mitreTechnique = mitreTechnique;
    }

    public Map<String, Object> getEvidence() {
        return evidence != null ? evidence : Collections.emptyMap();
    }

    public void setEvidence(Map<String, Object> evidence) {
        this.evidence = evidence;
    }

    public Map<String, Object> getActiveResponse() {
        return activeResponse;
    }

    public void setActiveResponse(Map<String, Object> activeResponse) {
        this.activeResponse = activeResponse;
    }

    public String getHostId() {
        if (hostId != null && !hostId.isEmpty()) {
            return hostId;
        }
        if (evidence != null && evidence.containsKey("endpoint.hostname")) {
            return String.valueOf(evidence.get("endpoint.hostname"));
        }
        return "unknown";
    }

    public void setHostId(String hostId) {
        this.hostId = hostId;
    }

    public String getAgentId() {
        return agentId;
    }

    public void setAgentId(String agentId) {
        this.agentId = agentId;
    }
}
