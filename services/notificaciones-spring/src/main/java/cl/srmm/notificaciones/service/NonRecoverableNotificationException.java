package cl.srmm.notificaciones.service;

public class NonRecoverableNotificationException extends RuntimeException {

    public NonRecoverableNotificationException(String message) {
        super(message);
    }

    public NonRecoverableNotificationException(String message, Throwable cause) {
        super(message, cause);
    }
}
