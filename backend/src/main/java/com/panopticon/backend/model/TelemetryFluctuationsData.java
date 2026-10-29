package com.panopticon.backend.model;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;
import java.util.Map;

public class TelemetryFluctuationsData {

    @JsonProperty("climatological_average")
    private List<Double> climatologicalAverage;

    @JsonProperty("historical_baselines")
    private Map<String, List<Double>> historicalBaselines;

    @JsonProperty("operational_cohorts")
    private Map<String, List<Double>> operationalCohorts;

    @JsonProperty("active_telemetry")
    private List<Double> activeTelemetry;

    @JsonProperty("incident_callouts")
    private List<IncidentCallout> incidentCallouts;

    public TelemetryFluctuationsData() {
    }

    public List<Double> getClimatologicalAverage() {
        return climatologicalAverage;
    }

    public void setClimatologicalAverage(List<Double> climatologicalAverage) {
        this.climatologicalAverage = climatologicalAverage;
    }

    public Map<String, List<Double>> getHistoricalBaselines() {
        return historicalBaselines;
    }

    public void setHistoricalBaselines(Map<String, List<Double>> historicalBaselines) {
        this.historicalBaselines = historicalBaselines;
    }

    public Map<String, List<Double>> getOperationalCohorts() {
        return operationalCohorts;
    }

    public void setOperationalCohorts(Map<String, List<Double>> operationalCohorts) {
        this.operationalCohorts = operationalCohorts;
    }

    public List<Double> getActiveTelemetry() {
        return activeTelemetry;
    }

    public void setActiveTelemetry(List<Double> activeTelemetry) {
        this.activeTelemetry = activeTelemetry;
    }

    public List<IncidentCallout> getIncidentCallouts() {
        return incidentCallouts;
    }

    public void setIncidentCallouts(List<IncidentCallout> incidentCallouts) {
        this.incidentCallouts = incidentCallouts;
    }

    public static class IncidentCallout {
        @JsonProperty("day_of_year")
        private int dayOfYear;

        @JsonProperty("date_label")
        private String dateLabel;

        @JsonProperty("alert_count")
        private int alertCount;

        @JsonProperty("title")
        private String title;

        @JsonProperty("volume_m")
        private double volumeM;

        public IncidentCallout() {
        }

        public IncidentCallout(int dayOfYear, String dateLabel, int alertCount, String title, double volumeM) {
            this.dayOfYear = dayOfYear;
            this.dateLabel = dateLabel;
            this.alertCount = alertCount;
            this.title = title;
            this.volumeM = volumeM;
        }

        public int getDayOfYear() {
            return dayOfYear;
        }

        public void setDayOfYear(int dayOfYear) {
            this.dayOfYear = dayOfYear;
        }

        public String getDateLabel() {
            return dateLabel;
        }

        public void setDateLabel(String dateLabel) {
            this.dateLabel = dateLabel;
        }

        public int getAlertCount() {
            return alertCount;
        }

        public void setAlertCount(int alertCount) {
            this.alertCount = alertCount;
        }

        public String getTitle() {
            return title;
        }

        public void setTitle(String title) {
            this.title = title;
        }

        public double getVolumeM() {
            return volumeM;
        }

        public void setVolumeM(double volumeM) {
            this.volumeM = volumeM;
        }
    }
}
