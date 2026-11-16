package cl.srmm.kafka.admin.api.dto;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.util.Map;
import java.util.Set;

public record CreateTopicRequest(
        @NotBlank
        @Size(max = 249)
        @Pattern(regexp = "^(?!\\.\\.?$)[a-zA-Z0-9._-]+$")
        String name,
        @Min(1) int partitions,
        @Min(1) int replicationFactor,
        Map<String, String> configs
) {
    private static final Set<String> CLEANUP_POLICIES = Set.of("delete", "compact", "compact,delete");

    @AssertTrue(message = "cleanup.policy debe ser delete, compact o compact,delete.")
    public boolean isCleanupPolicySupported() {
        return configs == null
                || !configs.containsKey("cleanup.policy")
                || CLEANUP_POLICIES.stream().anyMatch(policy -> policy.equals(configs.get("cleanup.policy")));
    }
}
