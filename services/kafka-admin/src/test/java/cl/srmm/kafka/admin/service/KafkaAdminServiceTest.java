package cl.srmm.kafka.admin.service;

import cl.srmm.kafka.admin.api.AdminApiException;
import cl.srmm.kafka.admin.api.dto.CreateTopicRequest;
import cl.srmm.kafka.admin.api.dto.ResetOffsetsRequest;
import cl.srmm.kafka.admin.api.dto.ResetOffsetsResponse;
import org.apache.kafka.clients.admin.AdminClient;
import org.apache.kafka.clients.admin.AlterConsumerGroupOffsetsResult;
import org.apache.kafka.clients.admin.ConsumerGroupDescription;
import org.apache.kafka.clients.admin.CreateTopicsResult;
import org.apache.kafka.clients.admin.DescribeClusterResult;
import org.apache.kafka.clients.admin.DescribeConsumerGroupsResult;
import org.apache.kafka.clients.admin.DescribeConfigsResult;
import org.apache.kafka.clients.admin.DescribeTopicsResult;
import org.apache.kafka.clients.admin.MemberDescription;
import org.apache.kafka.clients.admin.Config;
import org.apache.kafka.clients.admin.ConfigEntry;
import org.apache.kafka.clients.admin.TopicDescription;
import org.apache.kafka.common.KafkaFuture;
import org.apache.kafka.common.Node;
import org.apache.kafka.common.TopicPartitionInfo;
import org.apache.kafka.common.config.ConfigResource;
import org.apache.kafka.clients.consumer.OffsetAndMetadata;
import org.apache.kafka.common.TopicPartition;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class KafkaAdminServiceTest {

    @Test
    void createsTopicWithRequestedReplicationAndConfig() {
        AdminClient adminClient = mock(AdminClient.class);
        DescribeClusterResult clusterResult = mock(DescribeClusterResult.class);
        CreateTopicsResult createResult = mock(CreateTopicsResult.class);
        DescribeTopicsResult topicsResult = mock(DescribeTopicsResult.class);
        DescribeConfigsResult configsResult = mock(DescribeConfigsResult.class);
        Node broker = new Node(1, "broker", 9092);
        Node broker2 = new Node(2, "broker2", 9092);
        Node broker3 = new Node(3, "broker3", 9092);
        String topicName = "srmm.test";
        ConfigResource resource = new ConfigResource(ConfigResource.Type.TOPIC, topicName);
        TopicDescription description = new TopicDescription(
                topicName,
                false,
                List.of(new TopicPartitionInfo(0, broker, List.of(broker, broker2, broker3),
                        List.of(broker, broker2, broker3))));

        when(adminClient.describeCluster()).thenReturn(clusterResult);
        when(clusterResult.nodes()).thenReturn(KafkaFuture.completedFuture(List.of(broker, broker2, broker3)));
        when(adminClient.createTopics(anyCollection())).thenReturn(createResult);
        when(createResult.all()).thenReturn(KafkaFuture.completedFuture(null));
        when(adminClient.describeTopics(anyCollection())).thenReturn(topicsResult);
        when(topicsResult.all()).thenReturn(KafkaFuture.completedFuture(Map.of(topicName, description)));
        when(adminClient.describeConfigs(anyCollection())).thenReturn(configsResult);
        when(configsResult.all()).thenReturn(KafkaFuture.completedFuture(
                Map.of(resource, new Config(List.of(new ConfigEntry("cleanup.policy", "compact"))))));

        var response = new KafkaAdminService(adminClient).createTopic(
                new CreateTopicRequest(topicName, 1, 3, Map.of("cleanup.policy", "compact")));

        assertEquals(topicName, response.name());
        assertEquals(1, response.partitions());
        assertEquals(3, response.replicationFactor());
        assertEquals("compact", response.configs().get("cleanup.policy"));
    }

    @Test
    void rejectsReplicationFactorAboveAvailableBrokers() {
        AdminClient adminClient = mock(AdminClient.class);
        DescribeClusterResult clusterResult = mock(DescribeClusterResult.class);
        when(adminClient.describeCluster()).thenReturn(clusterResult);
        when(clusterResult.nodes()).thenReturn(KafkaFuture.completedFuture(List.of(new Node(1, "broker", 9092))));

        AdminApiException exception = assertThrows(
                AdminApiException.class,
                () -> new KafkaAdminService(adminClient).createTopic(
                        new CreateTopicRequest("srmm.test", 1, 2, null)));

        assertEquals(400, exception.getStatus().value());
        verify(adminClient, never()).createTopics(anyCollection());
    }

    @Test
    void refusesToResetOffsetsWhenGroupHasActiveMembers() {
        AdminClient adminClient = mock(AdminClient.class);
        DescribeConsumerGroupsResult describeResult = mock(DescribeConsumerGroupsResult.class);
        ConsumerGroupDescription group = mock(ConsumerGroupDescription.class);
        when(adminClient.describeConsumerGroups(List.of("srmm-group"))).thenReturn(describeResult);
        when(describeResult.describedGroups()).thenReturn(
                Map.of("srmm-group", KafkaFuture.completedFuture(group)));
        when(group.members()).thenReturn(Set.of(mock(MemberDescription.class)));

        AdminApiException exception = assertThrows(
                AdminApiException.class,
                () -> new KafkaAdminService(adminClient).resetConsumerGroupOffsets(
                        "srmm-group",
                        new ResetOffsetsRequest(List.of(
                                new ResetOffsetsRequest.OffsetReset("srmm.test", 0, 42)))));

        assertEquals(409, exception.getStatus().value());
        verify(adminClient, never()).alterConsumerGroupOffsets(eq("srmm-group"), anyMap());
    }

    @Test
    void resetsOffsetsForAnInactiveGroup() {
        AdminClient adminClient = mock(AdminClient.class);
        DescribeConsumerGroupsResult describeResult = mock(DescribeConsumerGroupsResult.class);
        AlterConsumerGroupOffsetsResult alterResult = mock(AlterConsumerGroupOffsetsResult.class);
        ConsumerGroupDescription group = mock(ConsumerGroupDescription.class);
        when(adminClient.describeConsumerGroups(List.of("srmm-group"))).thenReturn(describeResult);
        when(describeResult.describedGroups()).thenReturn(
                Map.of("srmm-group", KafkaFuture.completedFuture(group)));
        when(group.members()).thenReturn(Set.of());
        when(adminClient.alterConsumerGroupOffsets(eq("srmm-group"), anyMap())).thenReturn(alterResult);
        when(alterResult.all()).thenReturn(KafkaFuture.completedFuture(null));

        ResetOffsetsResponse response = new KafkaAdminService(adminClient).resetConsumerGroupOffsets(
                "srmm-group",
                new ResetOffsetsRequest(List.of(
                        new ResetOffsetsRequest.OffsetReset("srmm.test", 2, 42))));

        assertEquals("srmm-group", response.groupId());
        assertEquals(1, response.updatedPartitions());
        verify(adminClient).alterConsumerGroupOffsets(eq("srmm-group"), argThat(offsets ->
                offsets.size() == 1
                        && offsets.get(new TopicPartition("srmm.test", 2)).offset() == 42L));
    }
}
