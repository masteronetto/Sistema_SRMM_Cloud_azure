package cl.srmm.kafka.bridge.dlq;

public record DeadLetterInfo(String eventId, String queue, String reason, long count) {
}