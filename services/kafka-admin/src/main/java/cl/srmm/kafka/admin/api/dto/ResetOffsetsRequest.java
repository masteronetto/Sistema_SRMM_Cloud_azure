package cl.srmm.kafka.admin.api.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

public record ResetOffsetsRequest(@NotEmpty List<@NotNull @Valid OffsetReset> offsets) {

    @AssertTrue(message = "No se permiten offsets duplicados para el mismo topic y partición.")
    public boolean hasUniqueTopicPartitions() {
        if (offsets == null) {
            return true;
        }
        if (offsets.stream().anyMatch(offset -> offset == null)) {
            return false;
        }
        Set<String> partitions = offsets.stream()
                .map(offset -> offset.topic() + "\u0000" + offset.partition())
                .collect(Collectors.toSet());
        return partitions.size() == offsets.size();
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
