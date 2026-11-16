package cl.srmm.kafka.analitica.api;

import cl.srmm.kafka.analitica.service.AnalyticsSummary;
import cl.srmm.kafka.analitica.service.EventoAnaliticaService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/analitica")
public class AnaliticaController {

    private final EventoAnaliticaService service;

    public AnaliticaController(EventoAnaliticaService service) {
        this.service = service;
    }

    @GetMapping("/resumen")
    public AnalyticsSummary resumen() {
        return service.resumen();
    }
}
