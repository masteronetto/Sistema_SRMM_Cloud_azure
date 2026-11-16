package cl.srmm.kafka.admin.api.dto;

public record ApiError(int status, String error, String message, String path) {
}
