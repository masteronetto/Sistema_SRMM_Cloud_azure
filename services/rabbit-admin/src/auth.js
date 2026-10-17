import { createRemoteJWKSet, decodeJwt, jwtVerify } from 'jose';
import { env } from './env.js';

const v1Issuer = env.azureTenantId ? `https://sts.windows.net/${env.azureTenantId}/` : '';
const v2Issuer = env.azureTenantId ? `https://login.microsoftonline.com/${env.azureTenantId}/v2.0` : '';
const v1Jwks = v1Issuer ? createRemoteJWKSet(new URL(`https://login.microsoftonline.com/${env.azureTenantId}/discovery/keys`)) : null;
const v2Jwks = v2Issuer ? createRemoteJWKSet(new URL(`https://login.microsoftonline.com/${env.azureTenantId}/discovery/v2.0/keys`)) : null;

export async function requireAdmin(req, res, next) {
  if (!env.azureAuthEnabled || !v1Jwks || !v2Jwks) {
    return res.status(503).json({ message: 'Autenticacion Azure AD aun no configurada para este entorno.' });
  }
  const authorization = req.get('authorization') || '';
  if (!authorization.startsWith('Bearer ')) return res.status(401).json({ message: 'Bearer requerido.' });

  try {
    const token = authorization.slice(7).trim();
    const unverified = decodeJwt(token);
    const isV1 = unverified.iss === v1Issuer;
    const { payload } = await jwtVerify(token, isV1 ? v1Jwks : v2Jwks, {
      issuer: isV1 ? v1Issuer : v2Issuer,
      audience: env.azureAudience
    });
    const scopes = String(payload.scp || '').split(' ').filter(Boolean);
    if (env.azureRequiredScope && !scopes.includes(env.azureRequiredScope)) {
      return res.status(403).json({ message: 'Scope insuficiente.' });
    }
    if (!Array.isArray(payload.roles) || !payload.roles.includes('Administrador')) {
      return res.status(403).json({ message: 'Se requiere el rol Administrador.' });
    }
    req.auth = payload;
    return next();
  } catch (error) {
    console.error('Rabbit-admin token validation failed:', error.message);
    return res.status(401).json({ message: 'Token Azure AD invalido o expirado.' });
  }
}
