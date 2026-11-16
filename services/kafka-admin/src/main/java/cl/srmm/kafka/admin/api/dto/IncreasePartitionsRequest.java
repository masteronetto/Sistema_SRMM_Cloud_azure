package cl.srmm.kafka.admin.api.dto;

import jakarta.validation.constraints.Min;

public record IncreasePartitionsRequest(@Min(1) int partitions) {
}
