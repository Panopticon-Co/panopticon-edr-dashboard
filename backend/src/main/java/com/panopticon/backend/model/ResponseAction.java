package com.panopticon.backend.model;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;
import java.util.Map;

@JsonInclude(JsonInclude.Include.NON_NULL)
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

    @JsonProperty("command_state")
    private String commandState;

    @JsonProperty("created_at")
    private String createdAt;

    @JsonProperty("authorized_at")
    private String authorizedAt;

    @JsonProperty("authorized_by")
    private String authorizedBy;

    @JsonProperty("decided_reason")
    private String decidedReason;

    @JsonProperty("audit")
    private List<Map<String, Object>> audit;

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

    public String getCommandState() {
        return commandState;
    }

    public void setCommandState(String commandState) {
        this.commandState = commandState;
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

    public List<Map<String, Object>> getAudit() {
        return audit;
    }

    public void setAudit(List<Map<String, Object>> audit) {
        this.audit = audit;
    }

    public static boolean validateTarget(ResponseActionType actionType, Map<String, Object> target) {
        if (actionType == null) {
            return false;
        }
        if (actionType.isProcessAction()) {
            if (target == null || target.isEmpty()) {
                return false;
            }
            Object pidObj = target.get("target_pid");
            if (pidObj == null) pidObj = target.get("pid");

            Object ticksObj = target.get("target_start_time_ticks");
            if (ticksObj == null) ticksObj = target.get("start_time_ticks");

            if (pidObj == null || ticksObj == null) {
                return false;
            }
            try {
                long pid = ((Number) pidObj).longValue();
                long ticks = ((Number) ticksObj).longValue();
                return pid > 0 && ticks > 0;
            } catch (Exception e) {
                return false;
            }
        } else if (actionType.isFileAction()) {
            if (target == null || target.isEmpty()) {
                return false;
            }
            Object pathObj = target.get("path");
            if (pathObj == null) pathObj = target.get("file_path");
            if (!(pathObj instanceof String pathStr)) {
                return false;
            }
            return !pathStr.isBlank() && pathStr.length() <= 4096;
        } else if (actionType.isHostAction()) {
            if (target == null || target.isEmpty()) {
                return true;
            }
            // Host actions can have host_id, but should not contain process or file params
            if (target.containsKey("target_pid") || target.containsKey("pid") ||
                target.containsKey("target_start_time_ticks") || target.containsKey("start_time_ticks") ||
                target.containsKey("path") || target.containsKey("file_path")) {
                return false;
            }
            return true;
        }
        return true;
    }
}
