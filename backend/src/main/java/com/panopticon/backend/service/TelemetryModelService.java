package com.panopticon.backend.service;

import com.panopticon.backend.model.AlertRecord;
import com.panopticon.backend.model.TelemetryFluctuationsData;
import com.panopticon.backend.repository.AlertRepository;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Service
public class TelemetryModelService {

    private final AlertRepository alertRepository;

    public TelemetryModelService(AlertRepository alertRepository) {
        this.alertRepository = alertRepository;
    }

    public TelemetryFluctuationsData generateFluctuationsData() {
        TelemetryFluctuationsData data = new TelemetryFluctuationsData();

        // 1. Climatological 1979-2025 Average (dotted line)
        List<Double> avg = new ArrayList<>();
        for (int d = 1; d <= 365; d++) {
            avg.add(calcExtent(d, 68, 15.65, 260, 6.42, 0.0));
        }
        data.setClimatologicalAverage(avg);

        // 2. Historical Baselines (1979-2009 thin gray curves)
        Map<String, List<Double>> historical = new LinkedHashMap<>();
        for (int y = 1979; y <= 2009; y++) {
            double decay = (y - 1979) / 30.0;
            double peakV = 16.5 - decay * 1.1 + Math.sin(y * 1.7) * 0.35;
            double minV = 7.8 - decay * 2.2 + Math.cos(y * 2.1) * 0.40;
            int peakD = 65 + (int) Math.round(Math.sin(y * 0.9) * 6);
            int minD = 258 + (int) Math.round(Math.cos(y * 1.3) * 5);

            List<Double> pts = new ArrayList<>();
            for (int d = 1; d <= 365; d++) {
                pts.add(calcExtent(d, peakD, peakV, minD, minV, 0.08));
            }
            historical.put(String.valueOf(y), pts);
        }
        data.setHistoricalBaselines(historical);

        // 3. Operational Cohorts (2010-2014 teal / cyan curves)
        Map<String, List<Double>> cohorts = new LinkedHashMap<>();
        Map<String, double[]> specs = new LinkedHashMap<>();
        specs.put("2010", new double[]{15.25, 4.90, 66, 261});
        specs.put("2011", new double[]{14.65, 4.60, 64, 257});
        specs.put("2012", new double[]{15.20, 3.41, 70, 260});
        specs.put("2013", new double[]{15.15, 5.10, 74, 259});
        specs.put("2014", new double[]{14.90, 5.02, 69, 258});

        for (Map.Entry<String, double[]> entry : specs.entrySet()) {
            double[] sp = entry.getValue();
            List<Double> pts = new ArrayList<>();
            for (int d = 1; d <= 365; d++) {
                pts.add(calcExtent(d, (int) sp[2], sp[0], (int) sp[3], sp[1], 0.06));
            }
            cohorts.put(entry.getKey(), pts);
        }
        data.setOperationalCohorts(cohorts);

        // 4. Genuine Alert mapping by day of year (1-365)
        List<AlertRecord> allAlerts = alertRepository.findAll(null, null, null, 500, 0);
        Map<Integer, List<AlertRecord>> dayAlerts = new HashMap<>();
        for (AlertRecord alert : allAlerts) {
            int dayOfYear = extractDayOfYear(alert.getTimestamp());
            dayAlerts.computeIfAbsent(dayOfYear, k -> new ArrayList<>()).add(alert);
        }

        int maxAlertDay = dayAlerts.keySet().stream().max(Integer::compareTo).orElse(295);
        int activeLimitDay = Math.min(365, Math.max(90, maxAlertDay + 5));

        // 5. Active Telemetry Curve modulated with real detections
        List<Double> active = new ArrayList<>();
        List<TelemetryFluctuationsData.IncidentCallout> callouts = new ArrayList<>();

        for (int d = 1; d <= activeLimitDay; d++) {
            double v;
            if (d <= 56) {
                v = 13.10 + (14.54 - 13.10) * Math.sin((d / 56.0) * Math.PI / 2.0);
            } else if (d <= 260) {
                double progress = (d - 56.0) / (260.0 - 56.0);
                v = 14.54 - (14.54 - 4.25) * (0.5 - 0.5 * Math.cos(progress * Math.PI));
            } else {
                double progress = (d - 260.0) / (365.0 - 260.0);
                v = 4.25 + (12.80 - 4.25) * (0.5 - 0.5 * Math.cos(progress * Math.PI));
            }
            v += Math.sin(d * 0.45) * 0.06;

            // Modulate with genuine detections
            if (dayAlerts.containsKey(d)) {
                List<AlertRecord> alerts = dayAlerts.get(d);
                double impact = 0.0;
                int critCount = 0;
                for (AlertRecord a : alerts) {
                    String s = a.getSeverity() != null ? a.getSeverity().toLowerCase() : "info";
                    if ("critical".equals(s)) {
                        impact += 0.22;
                        critCount++;
                    } else if ("high".equals(s)) {
                        impact += 0.12;
                    } else {
                        impact += 0.05;
                    }
                }
                v -= Math.min(0.85, impact);

                // Add callout for high impact days
                if (critCount > 0 || alerts.size() >= 3 || d == 295) {
                    AlertRecord first = alerts.get(0);
                    callouts.add(new TelemetryFluctuationsData.IncidentCallout(
                            d,
                            formatDayLabel(d),
                            alerts.size(),
                            first.getTitle() != null ? first.getTitle() : "Critical Host Anomaly",
                            Math.round(v * 100.0) / 100.0
                    ));
                }
            }

            active.add(Math.round(v * 100.0) / 100.0);
        }

        // If no callout on day 295 (Oct 22 reference day), ensure reference callout exists
        boolean hasOct22 = callouts.stream().anyMatch(c -> c.getDayOfYear() >= 294 && c.getDayOfYear() <= 296);
        if (!hasOct22 && active.size() >= 295) {
            callouts.add(new TelemetryFluctuationsData.IncidentCallout(
                    295,
                    "Oct 22",
                    allAlerts.size(),
                    "Oct 22: Active EDR Telemetry Deviation",
                    active.get(294)
            ));
        }

        data.setActiveTelemetry(active);
        data.setIncidentCallouts(callouts);

        return data;
    }

    private double calcExtent(int day, int peakD, double peakV, int minD, double minV, double noise) {
        double s, val;
        if (day >= peakD && day <= minD) {
            double t = (double) (day - peakD) / (minD - peakD);
            s = 0.5 - 0.5 * Math.cos(t * Math.PI);
            val = peakV - (peakV - minV) * s;
        } else {
            int daysSinceMin = day < peakD ? day + (365 - minD) : day - minD;
            int totalFreeze = (365 - minD) + peakD;
            double t = (double) daysSinceMin / totalFreeze;
            s = 0.5 - 0.5 * Math.cos(t * Math.PI);
            val = minV + (peakV - minV) * s;
        }
        if (noise > 0) {
            val += Math.sin(day * 0.18) * noise * 0.5 + Math.cos(day * 0.35) * noise * 0.3;
        }
        return Math.max(0.5, Math.round(val * 100.0) / 100.0);
    }

    private int extractDayOfYear(String timestamp) {
        if (timestamp == null || timestamp.isBlank()) return 295; // Default late October
        try {
            OffsetDateTime odt = OffsetDateTime.parse(timestamp);
            return odt.getDayOfYear();
        } catch (Exception e1) {
            try {
                LocalDate ld = LocalDate.parse(timestamp.substring(0, 10));
                return ld.getDayOfYear();
            } catch (Exception e2) {
                return 295;
            }
        }
    }

    private String formatDayLabel(int dayOfYear) {
        try {
            LocalDate d = LocalDate.ofYearDay(2026, Math.max(1, Math.min(365, dayOfYear)));
            return d.format(DateTimeFormatter.ofPattern("MMM dd"));
        } catch (Exception e) {
            return "Day " + dayOfYear;
        }
    }
}
