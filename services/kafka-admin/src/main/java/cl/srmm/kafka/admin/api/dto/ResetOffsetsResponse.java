package cl.srmm.kafka.admin.api.dto;

public record ResetOffsetsResponse(String groupId, int updatedPartitions) {
}
