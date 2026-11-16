package cl.srmm.kafka.admin.api;

import org.springframework.http.HttpStatus;

public class AdminApiException extends RuntimeException {

    private final HttpStatus status;

    public AdminApiException(HttpStatus status, String message) {
        super(message);
        this.status = status;
    }

    public HttpStatus getStatus() {
        return status;
    }
}
