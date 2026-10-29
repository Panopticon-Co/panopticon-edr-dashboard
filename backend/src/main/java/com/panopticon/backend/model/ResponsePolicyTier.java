package com.panopticon.backend.model;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

import java.util.Locale;

public enum ResponsePolicyTier {
    AUTO_SAFE,
    ANALYST_APPROVAL;

    @JsonValue
    public String getTierName() {
        return name();
    }

    @JsonCreator
    public static ResponsePolicyTier fromString(String value) {
        if (value == null || value.isBlank()) {
            return ANALYST_APPROVAL;
        }
        try {
            return ResponsePolicyTier.valueOf(value.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            return ANALYST_APPROVAL;
        }
    }

    public static ResponsePolicyTier forAction(ResponseActionType actionType) {
        if (actionType == null) {
            return ANALYST_APPROVAL;
        }
        if (actionType == ResponseActionType.COLLECT_PROCESS_INFO ||
            actionType == ResponseActionType.COLLECT_NETWORK_CONNECTIONS) {
            return AUTO_SAFE;
        }
        return ANALYST_APPROVAL;
    }
}
