package cl.srmm.kafka.analitica.api;

import cl.srmm.kafka.analitica.config.SecurityConfiguration;
import cl.srmm.kafka.analitica.service.EventoAnaliticaService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = AnaliticaController.class, properties = {
        "srmm.security.azure.enabled=true",
        "srmm.security.azure.tenant-id=tenant-de-prueba",
        "srmm.security.azure.audience=api://prueba",
        "srmm.security.azure.required-scope=access_as_user"
})
@Import(SecurityConfiguration.class)
class AnaliticaSecurityTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private EventoAnaliticaService service;

    @Test
    void rejectsRequestWithoutToken() throws Exception {
        mockMvc.perform(get("/analitica/resumen"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void rejectsMalformedToken() throws Exception {
        mockMvc.perform(get("/analitica/resumen").header("Authorization", "Bearer no-es-un-jwt"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void rejectsValidJwtWithoutAdminRole() throws Exception {
        mockMvc.perform(get("/analitica/resumen")
                        .with(jwt().authorities(() -> "SCOPE_access_as_user")))
                .andExpect(status().isForbidden());
    }

    @Test
    void allowsAdminWithRequiredScope() throws Exception {
        mockMvc.perform(get("/analitica/resumen")
                        .with(jwt().authorities(() -> "ROLE_Administrador", () -> "SCOPE_access_as_user")))
                .andExpect(status().isOk());
    }
}