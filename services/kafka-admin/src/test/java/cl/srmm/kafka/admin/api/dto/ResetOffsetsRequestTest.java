package cl.srmm.kafka.admin.api.dto;

import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ResetOffsetsRequestTest {

    private static jakarta.validation.ValidatorFactory validatorFactory;
    private static Validator validator;

    @BeforeAll
    static void setUpValidator() {
        validatorFactory = Validation.buildDefaultValidatorFactory();
        validator = validatorFactory.getValidator();
    }

    @AfterAll
    static void closeValidator() {
        validatorFactory.close();
    }

    @Test
    void offsetsWithoutModeAreValidAndInferSpecificMode() {
        ResetOffsetsRequest request = new ResetOffsetsRequest(
                null,
                List.of(new ResetOffsetsRequest.OffsetReset("srmm.test", 0, 42)),
                null);

        assertTrue(validator.validate(request).isEmpty());
        assertTrue(request.effectiveMode() == ResetOffsetsRequest.ResetMode.ESPECIFICO);
    }

    @Test
    void rejectsSpecificModeWithoutOffsets() {
        ResetOffsetsRequest request = new ResetOffsetsRequest(
                ResetOffsetsRequest.ResetMode.ESPECIFICO, null, null);

        assertFalse(validator.validate(request).isEmpty());
    }

    @Test
    void rejectsBoundaryModeWithExplicitOffsets() {
        ResetOffsetsRequest request = new ResetOffsetsRequest(
                ResetOffsetsRequest.ResetMode.EARLIEST,
                List.of(new ResetOffsetsRequest.OffsetReset("srmm.test", 0, 42)),
                null);

        assertFalse(validator.validate(request).isEmpty());
    }

    @Test
    void rejectsRequestsWithoutModeOffsetsOrTopics() {
        assertFalse(validator.validate(new ResetOffsetsRequest(null, null, null)).isEmpty());
    }
}
