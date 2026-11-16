package cl.srmm.kafka.admin.api.dto;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotEmpty;

import java.util.Map;
import java.util.Set;

public record TopicConfigRequest(@NotEmpty Map<String, String> configs) {
    private static final Set<String> CLEANUP_POLICIES = Set.of("delete", "compact", "compact,delete");

    @AssertTrue(message = "cleanup.policy debe ser delete, compact o compact,delete.")
    public boolean isCleanupPolicySupported() {
        return configs != null
                && (!configs.containsKey("cleanup.policy")
                || CLEANUP_POLICIES.stream().anyMatch(policy -> policy.equals(configs.get("cleanup.policy"))));
    }
}
