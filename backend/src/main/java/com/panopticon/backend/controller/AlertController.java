package com.panopticon.backend.controller;

import com.panopticon.backend.model.AlertRecord;
import com.panopticon.backend.repository.AlertRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
public class AlertController {

    private final AlertRepository alertRepository;

    public AlertController(AlertRepository alertRepository) {
        this.alertRepository = alertRepository;
    }

    @GetMapping({"/api/v1/alerts", "/api/alerts"})
    public ResponseEntity<List<AlertRecord>> listAlerts(
            @RequestParam(required = false, name = "host_id") String hostId,
            @RequestParam(required = false, name = "severity") String severity,
            @RequestParam(required = false, name = "search") String search,
            @RequestParam(defaultValue = "100") int limit,
            @RequestParam(defaultValue = "0") int offset) {

        List<AlertRecord> alerts = alertRepository.findAll(hostId, severity, search, limit, offset);
        return ResponseEntity.ok(alerts);
    }

    @GetMapping("/api/v1/alerts/{id}")
    public ResponseEntity<AlertRecord> getAlertById(@PathVariable("id") String alertId) {
        return alertRepository.findById(alertId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }
}
