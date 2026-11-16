package cl.srmm.kafka.admin.api.dto;

import java.util.Map;

public record TopicDetails(
        String name,
        int partitions,
        int replicationFactor,
        Map<String, String> configs
) {
}
