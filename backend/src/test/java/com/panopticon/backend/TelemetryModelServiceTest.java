package com.panopticon.backend;

import com.panopticon.backend.model.AlertRecord;
import com.panopticon.backend.model.TelemetryFluctuationsData;
import com.panopticon.backend.repository.AlertRepository;
import com.panopticon.backend.service.TelemetryModelService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
public class TelemetryModelServiceTest {

    @Autowired
    private TelemetryModelService telemetryModelService;

    @Autowired
    private AlertRepository alertRepository;

    @Test
    void testGenerateFluctuationsDataStructure() {
        // Seed an alert on Day 295 (Oct 22)
        AlertRecord alert = new AlertRecord();
        alert.setAlertId("ALT-OCT22");
        alert.setRuleId("panopticon.edr.anomaly");
        alert.setTitle("Oct 22 Telemetry Anomaly");
        alert.setSeverity("critical");
        alert.setHostId("SRV-PROD-01");
        alert.setTimestamp("2026-10-22T10:00:00Z");
        alertRepository.insertOrIgnore(alert);

        TelemetryFluctuationsData data = telemetryModelService.generateFluctuationsData();

        assertNotNull(data);

        // Verify Climatological Average has 365 daily points
        assertNotNull(data.getClimatologicalAverage());
        assertEquals(365, data.getClimatologicalAverage().size(), "Average curve must span 365 days");

        // Verify Historical Baselines contains 1979 through 2009 (31 curves)
        assertNotNull(data.getHistoricalBaselines());
        assertEquals(31, data.getHistoricalBaselines().size(), "Historical baselines must contain 31 annual curves (1979-2009)");
        assertTrue(data.getHistoricalBaselines().containsKey("1979"));
        assertTrue(data.getHistoricalBaselines().containsKey("2009"));

        // Verify Operational Cohorts (2010 through 2014)
        assertNotNull(data.getOperationalCohorts());
        assertEquals(5, data.getOperationalCohorts().size());
        assertTrue(data.getOperationalCohorts().containsKey("2012"));

        // Verify Active Telemetry curve
        assertNotNull(data.getActiveTelemetry());
        assertFalse(data.getActiveTelemetry().isEmpty());

        // Verify Incident Callouts includes Oct 22
        assertNotNull(data.getIncidentCallouts());
        assertFalse(data.getIncidentCallouts().isEmpty());
        boolean hasOct22 = data.getIncidentCallouts().stream()
                .anyMatch(c -> c.getDayOfYear() >= 294 && c.getDayOfYear() <= 296);
        assertTrue(hasOct22, "Incident callouts must include Oct 22 focal reference");
    }
}
