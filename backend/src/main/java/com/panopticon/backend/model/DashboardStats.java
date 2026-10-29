package com.panopticon.backend.model;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.Map;

public class DashboardStats {

    @JsonProperty("total")
    private long total;

    @JsonProperty("critical")
    private long critical;

    @JsonProperty("high")
    private long high;

    @JsonProperty("medium")
    private long medium;

    @JsonProperty("low")
    private long low;

    @JsonProperty("info")
    private long info;

    @JsonProperty("hosts")
    private long hosts;

    @JsonProperty("hosts_alerting")
    private long hostsAlerting;

    @JsonProperty("pending_approvals")
    private long pendingApprovals;

    @JsonProperty("classification_counts")
    private Map<String, Long> classificationCounts;

    public DashboardStats() {
    }

    public DashboardStats(long total, long critical, long high, long medium, long low, long info, long hosts) {
        this.total = total;
        this.critical = critical;
        this.high = high;
        this.medium = medium;
        this.low = low;
        this.info = info;
        this.hosts = hosts;
        this.hostsAlerting = hosts;
    }

    public long getTotal() {
        return total;
    }

    public void setTotal(long total) {
        this.total = total;
    }

    public long getCritical() {
        return critical;
    }

    public void setCritical(long critical) {
        this.critical = critical;
    }

    public long getHigh() {
        return high;
    }

    public void setHigh(long high) {
        this.high = high;
    }

    public long getMedium() {
        return medium;
    }

    public void setMedium(long medium) {
        this.medium = medium;
    }

    public long getLow() {
        return low;
    }

    public void setLow(long low) {
        this.low = low;
    }

    public long getInfo() {
        return info;
    }

    public void setInfo(long info) {
        this.info = info;
    }

    public long getHosts() {
        return hosts;
    }

    public void setHosts(long hosts) {
        this.hosts = hosts;
        this.hostsAlerting = hosts;
    }

    public long getHostsAlerting() {
        return hostsAlerting;
    }

    public void setHostsAlerting(long hostsAlerting) {
        this.hostsAlerting = hostsAlerting;
        this.hosts = hostsAlerting;
    }

    public long getPendingApprovals() {
        return pendingApprovals;
    }

    public void setPendingApprovals(long pendingApprovals) {
        this.pendingApprovals = pendingApprovals;
    }

    public Map<String, Long> getClassificationCounts() {
        return classificationCounts;
    }

    public void setClassificationCounts(Map<String, Long> classificationCounts) {
        this.classificationCounts = classificationCounts;
    }
}
