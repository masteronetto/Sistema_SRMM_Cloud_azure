package cl.srmm.kafka.admin.api.dto;

import java.util.List;

public record ConsumerGroupDetails(
        String id,
        String state,
        List<Member> members,
        List<PartitionOffset> offsets
) {
    public record Member(
            String memberId,
            String clientId,
            String host,
            List<AssignedPartition> assignment
    ) {
    }

    public record AssignedPartition(String topic, int partition) {
    }

    public record PartitionOffset(
            String topic,
            int partition,
            long committedOffset,
            long logEndOffset,
            long lag
    ) {
    }
}
