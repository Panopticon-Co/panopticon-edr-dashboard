package com.panopticon.backend.model;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

import java.util.Locale;

public enum ResponseActionType {
    KILL_PROCESS(true),
    COLLECT_PROCESS_INFO(false),
    COLLECT_NETWORK_CONNECTIONS(false),
    COLLECT_FILE(false),
    QUARANTINE_FILE(false),
    ISOLATE_HOST(true),
    RELEASE_HOST_ISOLATION(true);

    private final boolean destructive;

    ResponseActionType(boolean destructive) {
        this.destructive = destructive;
    }

    public boolean isDestructive() {
        return destructive;
    }

    public boolean isProcessAction() {
        return this == KILL_PROCESS || this == COLLECT_PROCESS_INFO;
    }

    public boolean isFileAction() {
        return this == COLLECT_FILE || this == QUARANTINE_FILE;
    }

    public boolean isHostAction() {
        return this == ISOLATE_HOST || this == RELEASE_HOST_ISOLATION || this == COLLECT_NETWORK_CONNECTIONS;
    }

    @JsonValue
    public String getActionName() {
        return name();
    }

    @JsonCreator
    public static ResponseActionType fromString(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        String normalized = value.trim().toUpperCase(Locale.ROOT);
        // Map legacy aliases
        if ("ISOLATE_NETWORK".equals(normalized)) {
            return ISOLATE_HOST;
        }
        if ("KILL_PROCESS".equals(normalized)) {
            return KILL_PROCESS;
        }
        try {
            return ResponseActionType.valueOf(normalized);
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    public static boolean isValid(String value) {
        return fromString(value) != null;
    }
}
