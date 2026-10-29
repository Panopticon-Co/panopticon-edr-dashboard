package com.panopticon.backend;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.panopticon.backend.model.AlertRecord;
import com.panopticon.backend.model.EndpointAsset;
import com.panopticon.backend.repository.AlertRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
public class AlertRepositoryTest {

    @Autowired
    private AlertRepository alertRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @BeforeEach
    void setUp() {
        jdbcTemplate.execute("DELETE FROM alerts");
    }

    @Test
    void testInsertAndFindById() {
        AlertRecord alert = new AlertRecord();
        alert.setAlertId("ALT-test-001");
        alert.setRuleId("panopticon.edr.test");
        alert.setTitle("Suspicious LSASS Memory Dump");
        alert.setSeverity("critical");
        alert.setLevel(4);
        alert.setHostId("WIN-DC-01");
        alert.setAgentId("AGT-101");
        alert.setTimestamp("2026-10-22T14:30:00Z");
        alert.setMitreTactic("Credential Access");
        alert.setMitreTechnique("T1003.001");
        alert.setEvidence(Map.of("process.name", "procdump.exe", "process.pid", 4420));

        boolean inserted = alertRepository.insertOrIgnore(alert);
        assertTrue(inserted, "First insert should succeed");

        // Idempotency check: duplicate insert should be ignored
        boolean secondInsert = alertRepository.insertOrIgnore(alert);
        assertFalse(secondInsert, "Duplicate insert with same alert_id should be ignored");

        Optional<AlertRecord> found = alertRepository.findById("ALT-test-001");
        assertTrue(found.isPresent());
        assertEquals("Suspicious LSASS Memory Dump", found.get().getTitle());
        assertEquals("critical", found.get().getSeverity());
        assertEquals("WIN-DC-01", found.get().getHostId());
    }

    @Test
    void testFindAllWithFilters() {
        AlertRecord a1 = new AlertRecord();
        a1.setAlertId("ALT-1");
        a1.setRuleId("panopticon.rule.one");
        a1.setTitle("Malicious PowerShell Encoded Command");
        a1.setSeverity("high");
        a1.setHostId("HOST-A");
        alertRepository.insertOrIgnore(a1);

        AlertRecord a2 = new AlertRecord();
        a2.setAlertId("ALT-2");
        a2.setRuleId("panopticon.rule.two");
        a2.setTitle("Unusual Outbound Beacon");
        a2.setSeverity("medium");
        a2.setHostId("HOST-B");
        alertRepository.insertOrIgnore(a2);

        List<AlertRecord> all = alertRepository.findAll(null, null, null, 10, 0);
        assertEquals(2, all.size());

        List<AlertRecord> hostFiltered = alertRepository.findAll("HOST-A", null, null, 10, 0);
        assertEquals(1, hostFiltered.size());
        assertEquals("ALT-1", hostFiltered.get(0).getAlertId());

        List<AlertRecord> severityFiltered = alertRepository.findAll(null, "medium", null, 10, 0);
        assertEquals(1, severityFiltered.size());
        assertEquals("ALT-2", severityFiltered.get(0).getAlertId());

        List<AlertRecord> searchFiltered = alertRepository.findAll(null, null, "PowerShell", 10, 0);
        assertEquals(1, searchFiltered.size());
        assertEquals("ALT-1", searchFiltered.get(0).getAlertId());
    }

    @Test
    void testCountAndImpactedEndpoints() {
        AlertRecord a1 = new AlertRecord();
        a1.setAlertId("ALT-C1");
        a1.setRuleId("rule.crit");
        a1.setTitle("Ransomware Encryption Activity");
        a1.setSeverity("critical");
        a1.setHostId("DC-PRIMARY");
        alertRepository.insertOrIgnore(a1);

        AlertRecord a2 = new AlertRecord();
        a2.setAlertId("ALT-C2");
        a2.setRuleId("rule.crit2");
        a2.setTitle("Shadow Copy Deletion");
        a2.setSeverity("critical");
        a2.setHostId("DC-PRIMARY");
        alertRepository.insertOrIgnore(a2);

        assertEquals(2, alertRepository.count());
        assertEquals(1, alertRepository.countDistinctHosts());

        List<EndpointAsset> endpoints = alertRepository.getImpactedEndpoints();
        assertFalse(endpoints.isEmpty());
        EndpointAsset ep = endpoints.get(0);
        assertEquals("DC-PRIMARY", ep.getHostId());
        assertEquals(2, ep.getTotalAlerts());
        assertEquals(2, ep.getCriticalAlerts());
        assertEquals("Domain Controller", ep.getRole());
    }
}
