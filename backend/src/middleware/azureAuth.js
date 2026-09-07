import { createRemoteJWKSet, decodeJwt, jwtVerify } from 'jose';
import { env } from '../config/env.js';

const v2Issuer = env.azureTenantId
  ? `https://login.microsoftonline.com/${env.azureTenantId}/v2.0`
  : '';
const v1Issuer = env.azureTenantId
  ? `https://sts.windows.net/${env.azureTenantId}/`
  : '';
const v2Jwks = v2Issuer
  ? createRemoteJWKSet(new URL(`https://login.microsoftonline.com/${env.azureTenantId}/discovery/v2.0/keys`))
  : null;
const v1Jwks = v1Issuer
  ? createRemoteJWKSet(new URL(`https://login.microsoftonline.com/${env.azureTenantId}/discovery/keys`))
  : null;

export async function requireAzureToken(req, res, next) {
  if (!env.azureAuthEnabled || !v1Jwks || !v2Jwks) {
    return res.status(503).json({
      message: 'Autenticacion Azure AD aun no configurada para este entorno.'
    });
  }

  const authorization = req.get('authorization') || '';
  if (!authorization.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Bearer token requerido.' });
  }

  try {
    const token = authorization.slice('Bearer '.length).trim();
    const unverified = decodeJwt(token);
    const isV1Token = unverified.iss === v1Issuer;
    const expectedIssuer = isV1Token ? v1Issuer : v2Issuer;
    const expectedJwks = isV1Token ? v1Jwks : v2Jwks;
    const { payload } = await jwtVerify(token, expectedJwks, {
      issuer: expectedIssuer,
      audience: env.azureAudience
    });

    if (env.azureRequiredScope) {
      const scopes = String(payload.scp || '').split(' ').filter(Boolean);
      if (!scopes.includes(env.azureRequiredScope)) {
        return res.status(403).json({ message: 'Scope insuficiente.' });
      }
    }

    req.auth = payload;
    return next();
  } catch (error) {
    const rawToken = authorization.slice('Bearer '.length).trim();
    let unverifiedClaims = null;
    try {
      const decoded = decodeJwt(rawToken);
      unverifiedClaims = {
        issuer: decoded.iss || null,
        audience: decoded.aud || null,
        scopes: decoded.scp || null,
        expiresAt: decoded.exp || null
      };
    } catch {
      unverifiedClaims = { tokenShape: rawToken.split('.').length };
    }

    console.error('Azure token validation failed:', {
      code: error.code || 'unknown',
      message: error.message,
      issuer: v2Issuer,
      v1Issuer,
      audience: env.azureAudience,
      unverifiedClaims
    });
    return res.status(401).json({
      message: 'Token Azure AD invalido o expirado.',
      ...(process.env.NODE_ENV !== 'production' ? {
        diagnostic: error.code || error.message,
        diagnosticMessage: error.message,
        expectedIssuer: `${v1Issuer} or ${v2Issuer}`,
        expectedAudience: env.azureAudience,
        unverifiedClaims
      } : {})
    });
  }
}
