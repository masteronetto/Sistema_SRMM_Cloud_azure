package cl.srmm.kafka.admin.api;

import cl.srmm.kafka.admin.api.dto.ConsumerGroupDetails;
import cl.srmm.kafka.admin.api.dto.ConsumerGroupSummary;
import cl.srmm.kafka.admin.api.dto.CreateTopicRequest;
import cl.srmm.kafka.admin.api.dto.IncreasePartitionsRequest;
import cl.srmm.kafka.admin.api.dto.ResetOffsetsRequest;
import cl.srmm.kafka.admin.api.dto.ResetOffsetsResponse;
import cl.srmm.kafka.admin.api.dto.TopicConfigRequest;
import cl.srmm.kafka.admin.api.dto.TopicDetails;
import cl.srmm.kafka.admin.api.dto.TopicSummary;
import cl.srmm.kafka.admin.service.KafkaAdminService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@Validated
@RestController
@RequestMapping
public class KafkaAdminController {

    private final KafkaAdminService service;

    public KafkaAdminController(KafkaAdminService service) {
        this.service = service;
    }

    @PostMapping("/topics")
    public ResponseEntity<TopicDetails> createTopic(@Valid @RequestBody CreateTopicRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.createTopic(request));
    }

    @GetMapping("/topics")
    public List<TopicSummary> listTopics() {
        return service.listTopics();
    }

    @GetMapping("/topics/{name}")
    public TopicDetails getTopic(
            @PathVariable @NotBlank @Size(max = 249) @Pattern(regexp = "^(?!\\.\\.?$)[a-zA-Z0-9._-]+$") String name
    ) {
        return service.getTopic(name);
    }

    @DeleteMapping("/topics/{name}")
    public ResponseEntity<Void> deleteTopic(
            @PathVariable @NotBlank @Size(max = 249) @Pattern(regexp = "^(?!\\.\\.?$)[a-zA-Z0-9._-]+$") String name
    ) {
        service.deleteTopic(name);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/topics/{name}/config")
    public TopicDetails updateTopicConfig(
            @PathVariable @NotBlank @Size(max = 249) @Pattern(regexp = "^(?!\\.\\.?$)[a-zA-Z0-9._-]+$") String name,
            @Valid @RequestBody TopicConfigRequest request
    ) {
        return service.updateTopicConfig(name, request);
    }

    @PatchMapping("/topics/{name}/partitions")
    public TopicDetails increasePartitions(
            @PathVariable @NotBlank @Size(max = 249) @Pattern(regexp = "^(?!\\.\\.?$)[a-zA-Z0-9._-]+$") String name,
            @Valid @RequestBody IncreasePartitionsRequest request
    ) {
        return service.increasePartitions(name, request.partitions());
    }

    @GetMapping("/consumer-groups")
    public List<ConsumerGroupSummary> listConsumerGroups() {
        return service.listConsumerGroups();
    }

    @GetMapping("/consumer-groups/{id}")
    public ConsumerGroupDetails getConsumerGroup(
            @PathVariable @NotBlank @Size(max = 255) String id
    ) {
        return service.getConsumerGroup(id);
    }

    @PostMapping("/consumer-groups/{id}/reset-offsets")
    public ResetOffsetsResponse resetConsumerGroupOffsets(
            @PathVariable @NotBlank @Size(max = 255) String id,
            @Valid @RequestBody ResetOffsetsRequest request
    ) {
        return service.resetConsumerGroupOffsets(id, request);
    }

    @DeleteMapping("/consumer-groups/{id}")
    public ResponseEntity<Void> deleteConsumerGroup(
            @PathVariable @NotBlank @Size(max = 255) String id
    ) {
        service.deleteConsumerGroup(id);
        return ResponseEntity.noContent().build();
    }
}
