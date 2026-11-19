package cl.srmm.notificaciones.dlq;

public record DeadLetterInfo(String eventId, String queue, String reason, long count){
}
