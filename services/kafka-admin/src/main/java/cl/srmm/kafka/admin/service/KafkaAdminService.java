package cl.srmm.kafka.admin.service;

import cl.srmm.kafka.admin.api.AdminApiException;
import cl.srmm.kafka.admin.api.dto.ConsumerGroupDetails;
import cl.srmm.kafka.admin.api.dto.ConsumerGroupSummary;
import cl.srmm.kafka.admin.api.dto.CreateTopicRequest;
import cl.srmm.kafka.admin.api.dto.ResetOffsetsRequest;
import cl.srmm.kafka.admin.api.dto.ResetOffsetsResponse;
import cl.srmm.kafka.admin.api.dto.TopicConfigRequest;
import cl.srmm.kafka.admin.api.dto.TopicDetails;
import cl.srmm.kafka.admin.api.dto.TopicSummary;
import org.apache.kafka.clients.admin.AdminClient;
import org.apache.kafka.clients.admin.AlterConfigOp;
import org.apache.kafka.clients.admin.ConfigEntry;
import org.apache.kafka.clients.admin.NewPartitions;
import org.apache.kafka.clients.admin.NewTopic;
import org.apache.kafka.clients.admin.OffsetSpec;
import org.apache.kafka.clients.admin.TopicDescription;
import org.apache.kafka.common.KafkaFuture;
import org.apache.kafka.common.TopicPartition;
import org.apache.kafka.clients.admin.Config;
import org.apache.kafka.common.config.ConfigResource;
import org.apache.kafka.clients.consumer.OffsetAndMetadata;
import org.apache.kafka.clients.admin.ListOffsetsResult;
import org.apache.kafka.clients.admin.ConsumerGroupDescription;
import org.apache.kafka.clients.admin.MemberDescription;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.stream.Collectors;

@Service
public class KafkaAdminService {

    private static final Logger LOGGER = LoggerFactory.getLogger(KafkaAdminService.class);
    private static final long ADMIN_TIMEOUT_SECONDS = 30;

    private final AdminClient adminClient;

    public KafkaAdminService(AdminClient adminClient) {
        this.adminClient = adminClient;
    }

    public List<TopicSummary> listTopics() {
        Collection<String> names = await(adminClient.listTopics().names(), "list topics");
        if (names.isEmpty()) {
            return List.of();
        }
        Map<String, TopicDescription> descriptions = await(
                adminClient.describeTopics(names).all(), "describe topics");
        return descriptions.values().stream()
                .map(this::toTopicSummary)
                .sorted(Comparator.comparing(TopicSummary::name))
                .toList();
    }

    public TopicDetails createTopic(CreateTopicRequest request) {
        int brokerCount = await(adminClient.describeCluster().nodes(), "describe brokers").size();
        if (request.replicationFactor() > brokerCount) {
            throw new AdminApiException(
                    HttpStatus.BAD_REQUEST,
                    "replicationFactor no puede superar la cantidad de brokers disponibles (" + brokerCount + ").");
        }

        NewTopic topic = new NewTopic(
                request.name(),
                request.partitions(),
                (short) request.replicationFactor());
        if (request.configs() != null && !request.configs().isEmpty()) {
            topic.configs(request.configs());
        }
        LOGGER.info("Creating Kafka topic. topic={} partitions={} replicationFactor={}",
                request.name(), request.partitions(), request.replicationFactor());
        await(adminClient.createTopics(List.of(topic)).all(), "create topic " + request.name());
        return getTopic(request.name());
    }

    public TopicDetails getTopic(String name) {
        TopicDescription description = describeTopic(name);
        ConfigResource resource = new ConfigResource(ConfigResource.Type.TOPIC, name);
        Config config = await(adminClient.describeConfigs(List.of(resource)).all(), "describe config " + name)
                .get(resource);
        Map<String, String> configs = new LinkedHashMap<>();
        config.entries().stream()
                .sorted(Comparator.comparing(ConfigEntry::name))
                .forEach(entry -> configs.put(entry.name(), entry.value()));
        TopicSummary summary = toTopicSummary(description);
        return new TopicDetails(summary.name(), summary.partitions(), summary.replicationFactor(), configs);
    }

    public void deleteTopic(String name) {
        LOGGER.info("Deleting Kafka topic. topic={}", name);
        await(adminClient.deleteTopics(List.of(name)).all(), "delete topic " + name);
    }

    public TopicDetails updateTopicConfig(String name, TopicConfigRequest request) {
        ConfigResource resource = new ConfigResource(ConfigResource.Type.TOPIC, name);
        List<AlterConfigOp> operations = request.configs().entrySet().stream()
                .map(entry -> new AlterConfigOp(
                        new ConfigEntry(entry.getKey(), entry.getValue()),
                        AlterConfigOp.OpType.SET))
                .toList();
        LOGGER.info("Updating Kafka topic config. topic={} configKeys={}", name, request.configs().keySet());
        await(adminClient.incrementalAlterConfigs(Map.of(resource, operations)).all(), "alter config " + name);
        return getTopic(name);
    }

    public TopicDetails increasePartitions(String name, int partitionCount) {
        TopicDescription current = describeTopic(name);
        if (partitionCount <= current.partitions().size()) {
            throw new AdminApiException(
                    HttpStatus.BAD_REQUEST,
                    "partitions debe ser mayor que la cantidad actual (" + current.partitions().size() + ").");
        }
        LOGGER.info("Increasing Kafka topic partitions. topic={} partitions={}", name, partitionCount);
        await(adminClient.createPartitions(Map.of(name, NewPartitions.increaseTo(partitionCount))).all(),
                "increase partitions for " + name);
        return getTopic(name);
    }

    public List<ConsumerGroupSummary> listConsumerGroups() {
        return await(adminClient.listConsumerGroups().all(), "list consumer groups").stream()
                .map(group -> new ConsumerGroupSummary(group.groupId()))
                .sorted(Comparator.comparing(ConsumerGroupSummary::id))
                .toList();
    }

    public ConsumerGroupDetails getConsumerGroup(String groupId) {
        ConsumerGroupDescription group = describeConsumerGroup(groupId);
        Map<TopicPartition, OffsetAndMetadata> committedOffsets = await(
                adminClient.listConsumerGroupOffsets(groupId).partitionsToOffsetAndMetadata(),
                "list offsets for group " + groupId);

        Map<TopicPartition, ListOffsetsResult.ListOffsetsResultInfo> logEndOffsets = Map.of();
        if (!committedOffsets.isEmpty()) {
            Map<TopicPartition, OffsetSpec> requests = committedOffsets.keySet().stream()
                    .collect(Collectors.toMap(partition -> partition, partition -> OffsetSpec.latest()));
            logEndOffsets = await(adminClient.listOffsets(requests).all(), "list end offsets for group " + groupId);
        }

        List<ConsumerGroupDetails.Member> members = group.members().stream()
                .map(this::toMember)
                .sorted(Comparator.comparing(ConsumerGroupDetails.Member::memberId))
                .toList();
        Map<TopicPartition, ListOffsetsResult.ListOffsetsResultInfo> finalLogEndOffsets = logEndOffsets;
        List<ConsumerGroupDetails.PartitionOffset> offsets = committedOffsets.entrySet().stream()
                .map(entry -> toPartitionOffset(entry, finalLogEndOffsets))
                .sorted(Comparator.comparing(ConsumerGroupDetails.PartitionOffset::topic)
                        .thenComparingInt(ConsumerGroupDetails.PartitionOffset::partition))
                .toList();
        return new ConsumerGroupDetails(groupId, group.state().toString(), members, offsets);
    }

    public ResetOffsetsResponse resetConsumerGroupOffsets(String groupId, ResetOffsetsRequest request) {
        ConsumerGroupDescription group = describeConsumerGroup(groupId);
        if (!group.members().isEmpty()) {
            throw new AdminApiException(HttpStatus.CONFLICT, "El consumer group debe estar inactivo para resetear offsets.");
        }

        Map<TopicPartition, OffsetAndMetadata> offsets = new LinkedHashMap<>();
        request.offsets().forEach(offset -> offsets.put(
                new TopicPartition(offset.topic(), offset.partition()),
                new OffsetAndMetadata(offset.offset())));
        LOGGER.info("Resetting Kafka consumer group offsets. groupId={} partitions={}",
                groupId, offsets.size());
        await(adminClient.alterConsumerGroupOffsets(groupId, offsets).all(),
                "reset offsets for group " + groupId);
        return new ResetOffsetsResponse(groupId, offsets.size());
    }

    public void deleteConsumerGroup(String groupId) {
        LOGGER.info("Deleting Kafka consumer group. groupId={}", groupId);
        await(adminClient.deleteConsumerGroups(List.of(groupId)).all(), "delete consumer group " + groupId);
    }

    private TopicDescription describeTopic(String name) {
        Map<String, TopicDescription> descriptions = await(
                adminClient.describeTopics(List.of(name)).all(), "describe topic " + name);
        TopicDescription description = descriptions.get(name);
        if (description == null) {
            throw new AdminApiException(HttpStatus.NOT_FOUND, "Topic inexistente: " + name);
        }
        return description;
    }

    private ConsumerGroupDescription describeConsumerGroup(String groupId) {
        Map<String, KafkaFuture<ConsumerGroupDescription>> descriptions =
                adminClient.describeConsumerGroups(List.of(groupId)).describedGroups();
        KafkaFuture<ConsumerGroupDescription> result = descriptions.get(groupId);
        if (result == null) {
            throw new AdminApiException(HttpStatus.NOT_FOUND, "Consumer group inexistente: " + groupId);
        }
        return await(result, "describe consumer group " + groupId);
    }

    private TopicSummary toTopicSummary(TopicDescription description) {
        int replicationFactor = description.partitions().isEmpty()
                ? 0
                : description.partitions().get(0).replicas().size();
        return new TopicSummary(description.name(), description.partitions().size(), replicationFactor);
    }

    private ConsumerGroupDetails.Member toMember(MemberDescription member) {
        List<ConsumerGroupDetails.AssignedPartition> assignments = member.assignment().topicPartitions().stream()
                .map(partition -> new ConsumerGroupDetails.AssignedPartition(
                        partition.topic(), partition.partition()))
                .sorted(Comparator.comparing(ConsumerGroupDetails.AssignedPartition::topic)
                        .thenComparingInt(ConsumerGroupDetails.AssignedPartition::partition))
                .toList();
        return new ConsumerGroupDetails.Member(
                member.consumerId(), member.clientId(), member.host(), assignments);
    }

    private ConsumerGroupDetails.PartitionOffset toPartitionOffset(
            Map.Entry<TopicPartition, OffsetAndMetadata> entry,
            Map<TopicPartition, ListOffsetsResult.ListOffsetsResultInfo> logEndOffsets
    ) {
        TopicPartition partition = entry.getKey();
        long committedOffset = entry.getValue().offset();
        ListOffsetsResult.ListOffsetsResultInfo endOffset = logEndOffsets.get(partition);
        if (endOffset == null) {
            throw new AdminApiException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "No se pudo obtener el offset final para " + partition.topic() + "-" + partition.partition() + ".");
        }
        long logEndOffset = endOffset.offset();
        long lag = Math.max(0, logEndOffset - committedOffset);
        return new ConsumerGroupDetails.PartitionOffset(
                partition.topic(), partition.partition(), committedOffset, logEndOffset, lag);
    }

    private <T> T await(KafkaFuture<T> future, String operation) {
        try {
            return future.get(ADMIN_TIMEOUT_SECONDS, TimeUnit.SECONDS);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new AdminApiException(HttpStatus.SERVICE_UNAVAILABLE, "Operación Kafka interrumpida.");
        } catch (TimeoutException exception) {
            LOGGER.error("Kafka AdminClient timed out. operation={}", operation, exception);
            throw new AdminApiException(HttpStatus.SERVICE_UNAVAILABLE, "Kafka no respondió a tiempo.");
        } catch (ExecutionException exception) {
            Throwable cause = exception.getCause() == null ? exception : exception.getCause();
            String exceptionType = cause.getClass().getSimpleName();
            if (exceptionType.equals("TopicExistsException")) {
                throw new AdminApiException(HttpStatus.CONFLICT, "El topic ya existe.");
            }
            if (exceptionType.equals("GroupNotEmptyException")) {
                throw new AdminApiException(HttpStatus.CONFLICT, "El consumer group tiene consumidores activos.");
            }
            if (exceptionType.equals("TopicDeletionDisabledException")) {
                throw new AdminApiException(HttpStatus.CONFLICT, "La eliminación de topics está deshabilitada en Kafka.");
            }
            if (exceptionType.equals("UnknownTopicOrPartitionException")
                    || exceptionType.equals("UnknownTopicIdException")
                    || exceptionType.equals("GroupIdNotFoundException")) {
                throw new AdminApiException(HttpStatus.NOT_FOUND, "El recurso Kafka solicitado no existe.");
            }
            if (exceptionType.equals("InvalidTopicException")
                    || exceptionType.equals("InvalidReplicationFactorException")
                    || exceptionType.equals("InvalidPartitionsException")
                    || exceptionType.equals("InvalidConfigurationException")
                    || exceptionType.equals("ConfigException")
                    || exceptionType.equals("OffsetOutOfRangeException")
                    || exceptionType.equals("InvalidRequestException")) {
                throw new AdminApiException(HttpStatus.BAD_REQUEST, "La solicitud no es válida para Kafka.");
            }
            LOGGER.error("Kafka AdminClient operation failed. operation={} cause={}",
                    operation, exceptionType, cause);
            throw new AdminApiException(
                    HttpStatus.SERVICE_UNAVAILABLE, "Kafka no pudo completar la operación solicitada.");
        }
    }
}
