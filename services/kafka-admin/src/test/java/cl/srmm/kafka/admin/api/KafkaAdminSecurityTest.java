package cl.srmm.kafka.admin.api;

import cl.srmm.kafka.admin.api.dto.TopicSummary;
import cl.srmm.kafka.admin.config.SecurityConfiguration;
import cl.srmm.kafka.admin.service.KafkaAdminService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.http.MediaType;

import java.util.List;

import static org.mockito.Mockito.when;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(
        controllers = KafkaAdminController.class,
        properties = {
                "srmm.security.azure.enabled=true",
                "srmm.security.azure.tenant-id=tenant-id",
                "srmm.security.azure.audience=api://srmm-kafka-admin",
                "srmm.security.azure.required-scope=access_as_user"
        }
)
@Import({SecurityConfiguration.class, ApiExceptionHandler.class})
class KafkaAdminSecurityTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private KafkaAdminService service;

    @Test
    void rejectsRequestsWithoutBearerToken() throws Exception {
        mockMvc.perform(get("/topics"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void rejectsTokenWithoutAdministratorRoleOrRequiredScope() throws Exception {
        mockMvc.perform(get("/topics").with(jwt().authorities(
                        new SimpleGrantedAuthority("ROLE_Administrador"))))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/topics").with(jwt().authorities(
                        new SimpleGrantedAuthority("SCOPE_access_as_user"))))
                .andExpect(status().isForbidden());
    }

    @Test
    void allowsAdministratorWithRequiredScope() throws Exception {
        when(service.listTopics()).thenReturn(List.of(new TopicSummary("srmm.test", 1, 1)));

        mockMvc.perform(get("/topics").with(jwt().authorities(
                        new SimpleGrantedAuthority("ROLE_Administrador"),
                        new SimpleGrantedAuthority("SCOPE_access_as_user"))))
                .andExpect(status().isOk());
    }

    @Test
    void rejectsInvalidTopicNameBeforeCallingService() throws Exception {
        mockMvc.perform(post("/topics")
                        .with(jwt().authorities(
                                new SimpleGrantedAuthority("ROLE_Administrador"),
                                new SimpleGrantedAuthority("SCOPE_access_as_user")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "name": "..",
                                  "partitions": 1,
                                  "replicationFactor": 1
                                }
                                """))
                .andExpect(status().isBadRequest());

        verifyNoInteractions(service);
    }
}
