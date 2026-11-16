package cl.srmm.kafka.admin.api.dto;

public record TopicSummary(String name, int partitions, int replicationFactor) {
}
