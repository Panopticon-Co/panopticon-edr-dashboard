package com.panopticon.backend.model;

import com.fasterxml.jackson.annotation.JsonProperty;

public class EndpointAsset {

    @JsonProperty("host_id")
    private String hostId;

    @JsonProperty("hostname")
    private String hostname;

    @JsonProperty("ip_address")
    private String ipAddress;

    @JsonProperty("os_type")
    private String osType;

    @JsonProperty("role")
    private String role;

    @JsonProperty("critical_alerts")
    private int criticalAlerts;

    @JsonProperty("high_alerts")
    private int highAlerts;

    @JsonProperty("total_alerts")
    private int totalAlerts;

    @JsonProperty("last_seen")
    private String lastSeen;

    public EndpointAsset() {
    }

    public EndpointAsset(String hostId, String hostname, String ipAddress, String osType, String role) {
        this.hostId = hostId;
        this.hostname = hostname;
        this.ipAddress = ipAddress;
        this.osType = osType;
        this.role = role;
    }

    public String getHostId() {
        return hostId;
    }

    public void setHostId(String hostId) {
        this.hostId = hostId;
    }

    public String getHostname() {
        return hostname;
    }

    public void setHostname(String hostname) {
        this.hostname = hostname;
    }

    public String getIpAddress() {
        return ipAddress;
    }

    public void setIpAddress(String ipAddress) {
        this.ipAddress = ipAddress;
    }

    public String getOsType() {
        return osType;
    }

    public void setOsType(String osType) {
        this.osType = osType;
    }

    public String getRole() {
        return role;
    }

    public void setRole(String role) {
        this.role = role;
    }

    public int getCriticalAlerts() {
        return criticalAlerts;
    }

    public void setCriticalAlerts(int criticalAlerts) {
        this.criticalAlerts = criticalAlerts;
    }

    public int getHighAlerts() {
        return highAlerts;
    }

    public void setHighAlerts(int highAlerts) {
        this.highAlerts = highAlerts;
    }

    public int getTotalAlerts() {
        return totalAlerts;
    }

    public void setTotalAlerts(int totalAlerts) {
        this.totalAlerts = totalAlerts;
    }

    public String getLastSeen() {
        return lastSeen;
    }

    public void setLastSeen(String lastSeen) {
        this.lastSeen = lastSeen;
    }
}
