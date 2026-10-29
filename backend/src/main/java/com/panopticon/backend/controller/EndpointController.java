package com.panopticon.backend.controller;

import com.panopticon.backend.model.EndpointAsset;
import com.panopticon.backend.repository.EndpointRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/endpoints")
public class EndpointController {

    private final EndpointRepository endpointRepository;

    public EndpointController(EndpointRepository endpointRepository) {
        this.endpointRepository = endpointRepository;
    }

    @GetMapping
    public ResponseEntity<List<EndpointAsset>> listEndpoints() {
        List<EndpointAsset> list = endpointRepository.findAll();
        return ResponseEntity.ok(list);
    }

    @GetMapping("/{id}")
    public ResponseEntity<EndpointAsset> getEndpointById(@PathVariable("id") String hostId) {
        return endpointRepository.findById(hostId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }
}
