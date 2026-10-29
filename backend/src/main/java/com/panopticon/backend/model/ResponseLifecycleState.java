package com.panopticon.backend.model;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

import java.util.Locale;

public enum ResponseLifecycleState {
    PENDING,
    AUTHORIZED,
    DISPATCHED,
    SUCCEEDED,
    FAILED,
    REJECTED,
    EXPIRED;

    @JsonValue
    public String getStateName() {
        return name();
    }

    public boolean isTerminal() {
        return this == SUCCEEDED || this == FAILED || this == REJECTED || this == EXPIRED;
    }

    @JsonCreator
    public static ResponseLifecycleState fromString(String value) {
        if (value == null || value.isBlank()) {
            return PENDING;
        }
        try {
            return ResponseLifecycleState.valueOf(value.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            return PENDING;
        }
    }

    public static boolean isValidTransition(ResponseLifecycleState from, ResponseLifecycleState to) {
        if (from == null || to == null) {
            return false;
        }
        if (from.isTerminal()) {
            return false;
        }
        return switch (from) {
            case PENDING -> to == AUTHORIZED || to == REJECTED || to == EXPIRED;
            case AUTHORIZED -> to == DISPATCHED || to == REJECTED;
            case DISPATCHED -> to == SUCCEEDED || to == FAILED;
            default -> false;
        };
    }
}
