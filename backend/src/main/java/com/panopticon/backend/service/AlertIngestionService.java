package com.panopticon.backend.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.panopticon.backend.model.AlertRecord;
import com.panopticon.backend.model.EndpointAsset;
import com.panopticon.backend.model.ResponseAction;
import com.panopticon.backend.repository.AlertRepository;
import com.panopticon.backend.repository.EndpointRepository;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileReader;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class AlertIngestionService {

    private static final Logger log = LoggerFactory.getLogger(AlertIngestionService.class);

    private final AlertRepository alertRepository;
    private final ResponseActionService responseActionService;
    private final EndpointRepository endpointRepository;
    private final ObjectMapper objectMapper;

    @Value("${panopticon.alerts.file-path:alerts.ndjson}")
    private String alertsFilePath;

    public AlertIngestionService(AlertRepository alertRepository,
                                 ResponseActionService responseActionService,
                                 EndpointRepository endpointRepository,
                                 ObjectMapper objectMapper) {
        this.alertRepository = alertRepository;
        this.responseActionService = responseActionService;
        this.endpointRepository = endpointRepository;
        this.objectMapper = objectMapper;
    }

    @PostConstruct
    public void init() {
        log.info("AlertIngestionService initializing. Watching alerts file: {}", alertsFilePath);
        int ingested = ingestFile();
        log.info("Initial alert ingestion complete. Ingested {} new alerts.", ingested);
        syncEndpoints();
        responseActionService.runExpirationSweep();
    }

    @Scheduled(fixedDelayString = "${panopticon.alerts.poll-interval-ms:15000}")
    public void scheduledPoll() {
        try {
            int count = ingestFile();
            if (count > 0) {
                log.info("Polled alerts file: ingested {} new alerts", count);
                syncEndpoints();
            }
            responseActionService.runExpirationSweep();
        } catch (Exception e) {
            log.warn("Error during scheduled alert poll: {}", e.getMessage());
        }
    }

    public synchronized int ingestFile() {
        File file = new File(alertsFilePath);
        if (!file.exists() || !file.isFile()) {
            log.debug("Alerts file does not exist at {}", alertsFilePath);
            return 0;
        }

        int newAlerts = 0;
        try (BufferedReader reader = new BufferedReader(new FileReader(file, StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) {
                line = line.trim();
                if (line.isEmpty()) continue;

                try {
                    Map<String, Object> map = objectMapper.readValue(line, new TypeReference<Map<String, Object>>() {});
                    AlertRecord alert = parseAlertRecord(map);
                    if (alert != null && alert.getAlertId() != null) {
                        boolean inserted = alertRepository.insertOrIgnore(alert);
                        if (inserted) {
                            newAlerts++;
                            // Check for active response recommendation
                            if (alert.getActiveResponse() != null && !alert.getActiveResponse().isEmpty()) {
                                stageResponseAction(alert);
                            }
                        }
                    }
                } catch (Exception ex) {
                    log.warn("Failed to parse alert line: {} - {}", ex.getMessage(), line);
                }
            }
        } catch (Exception e) {
            log.error("Error reading alerts file: {}", e.getMessage(), e);
        }
        return newAlerts;
    }

    @SuppressWarnings("unchecked")
    private AlertRecord parseAlertRecord(Map<String, Object> map) {
        AlertRecord alert = new AlertRecord();
        alert.setAlertId((String) map.get("alert_id"));
        alert.setRuleId((String) map.get("rule_id"));
        alert.setTitle((String) map.get("title"));
        alert.setSeverity((String) map.get("severity"));

        Object lvl = map.get("level");
        if (lvl instanceof Number n) {
            alert.setLevel(n.intValue());
        }

        alert.setHostId((String) map.get("host_id"));
        alert.setAgentId((String) map.get("agent_id"));
        alert.setTimestamp((String) map.get("timestamp"));
        alert.setMitreTactic((String) map.get("mitre_tactic"));
        alert.setMitreTechnique((String) map.get("mitre_technique"));

        if (map.get("evidence") instanceof Map) {
            alert.setEvidence((Map<String, Object>) map.get("evidence"));
            if (alert.getHostId() == null || alert.getHostId().isBlank()) {
                Map<String, Object> ev = alert.getEvidence();
                if (ev.containsKey("host.id")) {
                    alert.setHostId(String.valueOf(ev.get("host.id")));
                } else if (ev.containsKey("agent.host")) {
                    alert.setHostId(String.valueOf(ev.get("agent.host")));
                }
            }
        }

        if (map.get("active_response") instanceof Map) {
            alert.setActiveResponse((Map<String, Object>) map.get("active_response"));
        }

        return alert;
    }

    @SuppressWarnings("unchecked")
    private void stageResponseAction(AlertRecord alert) {
        Map<String, Object> ar = alert.getActiveResponse();
        String actionName = (String) ar.get("action");
        if (actionName == null || actionName.isBlank()) return;

        ResponseAction responseAction = new ResponseAction();
        String responseId = "rsp-" + UUID.randomUUID().toString().substring(0, 8);
        responseAction.setResponseId(responseId);
        responseAction.setAlertId(alert.getAlertId());
        responseAction.setAction(actionName);
        responseAction.setCreatedAt(alert.getTimestamp() != null ? alert.getTimestamp() : Instant.now().toString());

        Object targetObj = ar.get("target");
        if (targetObj instanceof Map) {
            responseAction.setTarget((Map<String, Object>) targetObj);
        } else {
            responseAction.setTarget(Map.of("host_id", alert.getHostId() != null ? alert.getHostId() : "unknown"));
        }

        responseActionService.submitOrStageAction(responseAction);
        log.info("Staged pending response action {} ({}) for alert {}", responseId, actionName, alert.getAlertId());
    }

    public void syncEndpoints() {
        List<EndpointAsset> impacted = alertRepository.getImpactedEndpoints();
        for (EndpointAsset ep : impacted) {
            endpointRepository.upsert(ep);
        }
    }
}
