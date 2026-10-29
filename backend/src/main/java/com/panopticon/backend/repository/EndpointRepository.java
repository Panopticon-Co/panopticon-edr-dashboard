package com.panopticon.backend.repository;

import com.panopticon.backend.model.EndpointAsset;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Repository
public class EndpointRepository {

    private final JdbcTemplate jdbcTemplate;

    public EndpointRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    private final RowMapper<EndpointAsset> rowMapper = (rs, rowNum) -> {
        EndpointAsset ep = new EndpointAsset();
        ep.setHostId(rs.getString("host_id"));
        ep.setHostname(rs.getString("hostname"));
        ep.setIpAddress(rs.getString("ip_address"));
        ep.setOsType(rs.getString("os_type"));
        ep.setRole(rs.getString("role"));
        ep.setTotalAlerts(rs.getInt("total_alerts"));
        ep.setLastSeen(rs.getString("last_seen"));
        return ep;
    };

    public List<EndpointAsset> findAll() {
        String sql = "SELECT * FROM endpoints ORDER BY total_alerts DESC, last_seen DESC";
        return jdbcTemplate.query(sql, rowMapper);
    }

    public Optional<EndpointAsset> findById(String hostId) {
        String sql = "SELECT * FROM endpoints WHERE host_id = ?";
        List<EndpointAsset> list = jdbcTemplate.query(sql, rowMapper, hostId);
        return list.isEmpty() ? Optional.empty() : Optional.of(list.get(0));
    }

    public boolean upsert(EndpointAsset ep) {
        String now = ep.getLastSeen() != null ? ep.getLastSeen() : Instant.now().toString();
        String sql = "INSERT INTO endpoints (host_id, hostname, ip_address, os_type, role, first_seen, last_seen, total_alerts) " +
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?) " +
                "ON CONFLICT(host_id) DO UPDATE SET " +
                "hostname = excluded.hostname, " +
                "ip_address = COALESCE(excluded.ip_address, endpoints.ip_address), " +
                "os_type = COALESCE(excluded.os_type, endpoints.os_type), " +
                "role = COALESCE(excluded.role, endpoints.role), " +
                "last_seen = excluded.last_seen, " +
                "total_alerts = excluded.total_alerts";

        int rows = jdbcTemplate.update(sql,
                ep.getHostId(),
                ep.getHostname() != null ? ep.getHostname() : ep.getHostId(),
                ep.getIpAddress(),
                ep.getOsType(),
                ep.getRole(),
                now,
                now,
                ep.getTotalAlerts()
        );
        return rows > 0;
    }
}
