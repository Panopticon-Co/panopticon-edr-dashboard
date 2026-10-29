package com.panopticon.backend.model;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.Map;

public class ResponseAction {

    @JsonProperty("response_id")
    private String responseId;

    @JsonProperty("alert_id")
    private String alertId;

    @JsonProperty("action")
    private String action;

    @JsonProperty("tier")
    private String tier;

    @JsonProperty("lifecycle_state")
    private String lifecycleState;

    @JsonProperty("target")
    private Map<String, Object> target;

    @JsonProperty("command_id")
    private String commandId;

    @JsonProperty("created_at")
    private String createdAt;

    @JsonProperty("authorized_at")
    private String authorizedAt;

    @JsonProperty("authorized_by")
    private String authorizedBy;

    @JsonProperty("decided_reason")
    private String decidedReason;

    public ResponseAction() {
    }

    public ResponseAction(String responseId, String alertId, String action, String tier, String lifecycleState) {
        this.responseId = responseId;
        this.alertId = alertId;
        this.action = action;
        this.tier = tier;
        this.lifecycleState = lifecycleState;
    }

    public String getResponseId() {
        return responseId;
    }

    public void setResponseId(String responseId) {
        this.responseId = responseId;
    }

    public String getAlertId() {
        return alertId;
    }

    public void setAlertId(String alertId) {
        this.alertId = alertId;
    }

    public String getAction() {
        return action;
    }

    public void setAction(String action) {
        this.action = action;
    }

    public String getTier() {
        return tier;
    }

    public void setTier(String tier) {
        this.tier = tier;
    }

    public String getLifecycleState() {
        return lifecycleState;
    }

    public void setLifecycleState(String lifecycleState) {
        this.lifecycleState = lifecycleState;
    }

    public Map<String, Object> getTarget() {
        return target;
    }

    public void setTarget(Map<String, Object> target) {
        this.target = target;
    }

    public String getCommandId() {
        return commandId;
    }

    public void setCommandId(String commandId) {
        this.commandId = commandId;
    }

    public String getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(String createdAt) {
        this.createdAt = createdAt;
    }

    public String getAuthorizedAt() {
        return authorizedAt;
    }

    public void setAuthorizedAt(String authorizedAt) {
        this.authorizedAt = authorizedAt;
    }

    public String getAuthorizedBy() {
        return authorizedBy;
    }

    public void setAuthorizedBy(String authorizedBy) {
        this.authorizedBy = authorizedBy;
    }

    public String getDecidedReason() {
        return decidedReason;
    }

    public void setDecidedReason(String decidedReason) {
        this.decidedReason = decidedReason;
    }
}
