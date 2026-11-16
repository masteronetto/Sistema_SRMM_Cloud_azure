package cl.srmm.kafka.admin.config;

import com.nimbusds.jwt.SignedJWT;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.AuthenticationManagerResolver;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.convert.converter.Converter;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.ProviderManager;
import org.springframework.security.authorization.AuthorizationDecision;
import org.springframework.security.authorization.AuthorizationManager;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationProvider;
import org.springframework.security.oauth2.server.resource.web.BearerTokenResolver;
import org.springframework.security.oauth2.server.resource.web.DefaultBearerTokenResolver;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.security.web.access.intercept.RequestAuthorizationContext;

import java.text.ParseException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.function.Supplier;

import static org.springframework.security.oauth2.jose.jws.SignatureAlgorithm.RS256;

@Configuration
public class SecurityConfiguration {

    private final boolean enabled;
    private final String tenantId;
    private final String audience;
    private final String requiredScope;

    public SecurityConfiguration(
            @Value("${srmm.security.azure.enabled:true}") boolean enabled,
            @Value("${srmm.security.azure.tenant-id:}") String tenantId,
            @Value("${srmm.security.azure.audience:}") String audience,
            @Value("${srmm.security.azure.required-scope:access_as_user}") String requiredScope
    ) {
        this.enabled = enabled;
        this.tenantId = tenantId;
        this.audience = audience;
        this.requiredScope = requiredScope;
    }

    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http.csrf(csrf -> csrf.disable())
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS));

        if (!enabled) {
            http.authorizeHttpRequests(authorize -> authorize.anyRequest().denyAll())
                    .exceptionHandling(exceptions -> exceptions
                            .authenticationEntryPoint(serviceUnavailableEntryPoint())
                            .accessDeniedHandler(serviceUnavailableAccessDeniedHandler()));
            return http.build();
        }

        if (tenantId.isBlank() || audience.isBlank() || requiredScope.isBlank()) {
            throw new IllegalStateException(
                    "AZURE_TENANT_ID, AZURE_API_AUDIENCE and AZURE_REQUIRED_SCOPE must be configured when AZURE_AUTH_ENABLED=true.");
        }

        AuthenticationEntryPoint unauthorized = (request, response, exception) ->
                writeSecurityError(response, 401, "Bearer token requerido o inválido.");
        AccessDeniedHandler forbidden = (request, response, exception) ->
                writeSecurityError(response, 403, "Se requiere el scope y rol Administrador.");

        http.authorizeHttpRequests(authorize -> authorize
                        .anyRequest().access(adminWithScope(requiredScope)))
                .oauth2ResourceServer(oauth2 -> oauth2
                        .authenticationManagerResolver(authenticationManagerResolver())
                        .authenticationEntryPoint(unauthorized)
                        .accessDeniedHandler(forbidden))
                .exceptionHandling(exceptions -> exceptions
                        .authenticationEntryPoint(unauthorized)
                        .accessDeniedHandler(forbidden));
        return http.build();
    }

    private AuthenticationManagerResolver<HttpServletRequest> authenticationManagerResolver() {
        String v1Issuer = "https://sts.windows.net/" + tenantId + "/";
        String v2Issuer = "https://login.microsoftonline.com/" + tenantId + "/v2.0";
        AuthenticationManager v1Manager = authenticationManager(
                decoder(v1Issuer, "https://login.microsoftonline.com/" + tenantId + "/discovery/keys"));
        AuthenticationManager v2Manager = authenticationManager(
                decoder(v2Issuer, "https://login.microsoftonline.com/" + tenantId + "/discovery/v2.0/keys"));
        Map<String, AuthenticationManager> managers = Map.of(v1Issuer, v1Manager, v2Issuer, v2Manager);
        BearerTokenResolver bearerTokenResolver = new DefaultBearerTokenResolver();

        return request -> {
            String token = bearerTokenResolver.resolve(request);
            if (token == null) {
                throw invalidToken("Bearer token requerido.");
            }
            String issuer;
            try {
                issuer = SignedJWT.parse(token).getJWTClaimsSet().getIssuer();
            } catch (ParseException exception) {
                throw invalidToken("JWT inválido.");
            }
            AuthenticationManager manager = managers.get(issuer);
            if (manager == null) {
                throw invalidToken("Issuer no confiable.");
            }
            return manager;
        };
    }

    private JwtDecoder decoder(String issuer, String jwkSetUri) {
        NimbusJwtDecoder decoder = NimbusJwtDecoder.withJwkSetUri(jwkSetUri)
                .jwsAlgorithm(RS256)
                .build();
        OAuth2TokenValidator<Jwt> audienceValidator = jwt -> jwt.getAudience().contains(audience)
                ? OAuth2TokenValidatorResult.success()
                : OAuth2TokenValidatorResult.failure(
                        new OAuth2Error("invalid_token", "Audience inválida.", null));
        decoder.setJwtValidator(new DelegatingOAuth2TokenValidator<>(
                JwtValidators.createDefaultWithIssuer(issuer),
                audienceValidator));
        return decoder;
    }

    private AuthenticationManager authenticationManager(JwtDecoder decoder) {
        JwtAuthenticationProvider provider = new JwtAuthenticationProvider(decoder);
        provider.setJwtAuthenticationConverter(jwtAuthenticationConverter());
        return new ProviderManager(provider);
    }

    private Converter<Jwt, ? extends AbstractAuthenticationToken> jwtAuthenticationConverter() {
        JwtAuthenticationConverter converter = new JwtAuthenticationConverter();
        converter.setJwtGrantedAuthoritiesConverter(jwt -> {
            Collection<GrantedAuthority> authorities = new ArrayList<>();
            String scopes = jwt.getClaimAsString("scp");
            if (scopes == null) {
                scopes = jwt.getClaimAsString("scope");
            }
            if (scopes != null) {
                Arrays.stream(scopes.split("\\s+"))
                        .filter(scope -> !scope.isBlank())
                        .map(scope -> new SimpleGrantedAuthority("SCOPE_" + scope))
                        .forEach(authorities::add);
            }
            List<String> roles = jwt.getClaimAsStringList("roles");
            if (roles != null) {
                roles.stream()
                        .map(role -> new SimpleGrantedAuthority("ROLE_" + role))
                        .forEach(authorities::add);
            }
            return authorities;
        });
        return converter;
    }

    private AuthorizationManager<RequestAuthorizationContext> adminWithScope(String scope) {
        return (Supplier<org.springframework.security.core.Authentication> authentication,
                RequestAuthorizationContext context) -> {
            Collection<? extends GrantedAuthority> authorities = authentication.get().getAuthorities();
            boolean isAdmin = authorities.stream()
                    .anyMatch(authority -> authority.getAuthority().equals("ROLE_Administrador"));
            boolean hasScope = authorities.stream()
                    .anyMatch(authority -> authority.getAuthority().equals("SCOPE_" + scope));
            return new AuthorizationDecision(isAdmin && hasScope);
        };
    }

    private AuthenticationEntryPoint serviceUnavailableEntryPoint() {
        return (request, response, exception) ->
                writeSecurityError(response, 503, "Autenticación Azure AD no configurada para este entorno.");
    }

    private AccessDeniedHandler serviceUnavailableAccessDeniedHandler() {
        return (request, response, exception) ->
                writeSecurityError(response, 503, "Autenticación Azure AD no configurada para este entorno.");
    }

    private static OAuth2AuthenticationException invalidToken(String description) {
        return new OAuth2AuthenticationException(new OAuth2Error("invalid_token", description, null));
    }

    private static void writeSecurityError(
            jakarta.servlet.http.HttpServletResponse response,
            int status,
            String message
    ) throws java.io.IOException {
        response.setStatus(status);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding("UTF-8");
        response.getWriter().write("{\"message\":\"" + message + "\"}");
    }
}
