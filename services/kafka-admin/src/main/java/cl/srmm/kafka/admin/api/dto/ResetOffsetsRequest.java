package cl.srmm.kafka.admin.api.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.util.List;
import java.util.HashSet;
import java.util.Set;
import java.util.stream.Collectors;

public record ResetOffsetsRequest(
        ResetMode modo,
        List<@NotNull @Valid OffsetReset> offsets,
        List<
                @NotBlank
                @Size(max = 249)
                @Pattern(regexp = "^(?!\\.\\.?$)[a-zA-Z0-9._-]+$")
                String> topics
) {

    @AssertTrue(message = "ESPECIFICO requiere offsets; EARLIEST y LATEST no aceptan offsets.")
    public boolean hasValidModePayload() {
        ResetMode effectiveMode = effectiveMode();
        if (effectiveMode == null) {
            return false;
        }
        if (effectiveMode == ResetMode.ESPECIFICO) {
            return offsets != null && !offsets.isEmpty();
        }
        return offsets == null || offsets.isEmpty();
    }

    @AssertTrue(message = "No se permiten offsets duplicados para el mismo topic y partición.")
    public boolean hasUniqueTopicPartitions() {
        if (offsets == null || offsets.stream().anyMatch(offset -> offset == null)) {
            return true;
        }
        Set<String> partitions = offsets.stream()
                .map(offset -> offset.topic() + "\u0000" + offset.partition())
                .collect(Collectors.toSet());
        return partitions.size() == offsets.size();
    }

    @AssertTrue(message = "No se permiten topics duplicados.")
    public boolean hasUniqueTopics() {
        return topics == null || new HashSet<>(topics).size() == topics.size();
    }

    public ResetMode effectiveMode() {
        return modo == null && offsets != null && !offsets.isEmpty()
                ? ResetMode.ESPECIFICO
                : modo;
    }

    public enum ResetMode {
        EARLIEST,
        LATEST,
        ESPECIFICO
    }

    public record OffsetReset(
            @NotBlank
            @Size(max = 249)
            @Pattern(regexp = "^(?!\\.\\.?$)[a-zA-Z0-9._-]+$")
            String topic,
            @Min(0) int partition,
            @Min(0) long offset
    ) {
    }
}
