package cl.srmm.kafka.analitica.service;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.SpringBootConfiguration;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

@SpringBootTest(
        classes = EventoAnaliticaServiceContextTest.TestApplication.class,
        webEnvironment = SpringBootTest.WebEnvironment.NONE
)
class EventoAnaliticaServiceContextTest {

    @Autowired
    private EventoAnaliticaService service;

    @Test
    void loadsServiceUsingItsSpringConstructor() {
        assertNotNull(service);
        assertEquals(300, service.resumen().windowSeconds());
    }

    @SpringBootConfiguration
    @EnableAutoConfiguration
    @Import(EventoAnaliticaService.class)
    static class TestApplication {
    }
}
