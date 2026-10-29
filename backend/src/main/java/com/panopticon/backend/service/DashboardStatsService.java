package com.panopticon.backend.service;

import com.panopticon.backend.model.DashboardStats;
import com.panopticon.backend.repository.AlertRepository;
import com.panopticon.backend.repository.ResponseActionRepository;
import org.springframework.stereotype.Service;

import java.util.Map;

@Service
public class DashboardStatsService {

    private final AlertRepository alertRepository;
    private final ResponseActionRepository responseActionRepository;

    public DashboardStatsService(AlertRepository alertRepository, ResponseActionRepository responseActionRepository) {
        this.alertRepository = alertRepository;
        this.responseActionRepository = responseActionRepository;
    }

    public DashboardStats getStats() {
        DashboardStats stats = new DashboardStats();
        long total = alertRepository.count();
        stats.setTotal(total);

        Map<String, Long> severityCounts = alertRepository.countBySeverity();
        stats.setCritical(severityCounts.getOrDefault("critical", 0L));
        stats.setHigh(severityCounts.getOrDefault("high", 0L));
        stats.setMedium(severityCounts.getOrDefault("medium", 0L));
        stats.setLow(severityCounts.getOrDefault("low", 0L));
        stats.setInfo(severityCounts.getOrDefault("info", 0L));
        stats.setClassificationCounts(severityCounts);

        long hosts = alertRepository.countDistinctHosts();
        stats.setHosts(hosts);
        stats.setHostsAlerting(hosts);

        long pending = responseActionRepository.countPending();
        stats.setPendingApprovals(pending);

        return stats;
    }
}
