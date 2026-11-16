package cl.srmm.kafka.bridge.messaging;

public class InvalidRabbitEventException extends RuntimeException {

    private final String eventId;

    public InvalidRabbitEventException(String eventId, String message) {
        super(message);
        this.eventId = eventId;
    }

    public InvalidRabbitEventException(String eventId, String message, Throwable cause) {
        super(message, cause);
        this.eventId = eventId;
    }

    public String getEventId() {
        return eventId;
    }
}
