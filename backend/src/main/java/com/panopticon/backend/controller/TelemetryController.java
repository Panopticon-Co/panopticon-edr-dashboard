package com.panopticon.backend.controller;

import com.panopticon.backend.model.TelemetryFluctuationsData;
import com.panopticon.backend.service.TelemetryModelService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/telemetry")
public class TelemetryController {

    private final TelemetryModelService telemetryModelService;

    public TelemetryController(TelemetryModelService telemetryModelService) {
        this.telemetryModelService = telemetryModelService;
    }

    @GetMapping("/fluctuations")
    public ResponseEntity<TelemetryFluctuationsData> getTelemetryFluctuations() {
        TelemetryFluctuationsData data = telemetryModelService.generateFluctuationsData();
        return ResponseEntity.ok(data);
    }
}
