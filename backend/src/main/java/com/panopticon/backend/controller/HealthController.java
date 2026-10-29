package com.panopticon.backend.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.Map;

@RestController
public class HealthController {

    private final Instant startTime = Instant.now();

    @GetMapping({"/api/v1/health", "/healthz"})
    public ResponseEntity<Map<String, Object>> health() {
        return ResponseEntity.ok(Map.of(
                "status", "healthy",
                "service", "panopticon-backend-service",
                "version", "1.0.0",
                "runtime", "OpenJDK 21 LTS / Spring Boot 3.3.5",
                "started_at", startTime.toString(),
                "timestamp", Instant.now().toString()
        ));
    }

    @GetMapping("/")
    public ResponseEntity<Map<String, Object>> rootIndex() {
        return ResponseEntity.ok(Map.of(
                "service", "Panopticon EDR Spring Boot REST API Service",
                "status", "online",
                "version", "1.0.0",
                "dashboard_ui", "http://localhost:8787",
                "endpoints", Map.of(
                        "health", "/api/v1/health",
                        "dashboard_stats", "/api/v1/dashboard/stats",
                        "alerts", "/api/v1/alerts",
                        "endpoints", "/api/v1/endpoints",
                        "response_actions", "/api/v1/response-actions"
                ),
                "auth_note", "Public REST endpoints require no credentials. Basic Auth user: admin, password: panopticon"
        ));
    }
}
