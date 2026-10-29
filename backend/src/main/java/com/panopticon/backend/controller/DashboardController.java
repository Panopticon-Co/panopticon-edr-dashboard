package com.panopticon.backend.controller;

import com.panopticon.backend.model.DashboardStats;
import com.panopticon.backend.service.DashboardStatsService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class DashboardController {

    private final DashboardStatsService dashboardStatsService;

    public DashboardController(DashboardStatsService dashboardStatsService) {
        this.dashboardStatsService = dashboardStatsService;
    }

    @GetMapping({"/api/v1/dashboard/stats", "/api/stats"})
    public ResponseEntity<DashboardStats> getStats() {
        DashboardStats stats = dashboardStatsService.getStats();
        return ResponseEntity.ok(stats);
    }
}
