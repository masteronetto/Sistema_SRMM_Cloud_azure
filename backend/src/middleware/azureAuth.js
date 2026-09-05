import { createRemoteJWKSet, jwtVerify } from 'jose';
import { env } from '../config/env.js';

const issuer = env.azureTenantId
  ? `https://login.microsoftonline.com/${env.azureTenantId}/v2.0`
  : '';
const jwks = issuer
  ? createRemoteJWKSet(new URL(`${issuer}/discovery/v2.0/keys`))
  : null;

export async function requireAzureToken(req, res, next) {
  if (!env.azureAuthEnabled || !jwks) {
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
    const { payload } = await jwtVerify(token, jwks, {
      issuer,
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
    console.error('Azure token validation failed:', error.code || error.message);
    return res.status(401).json({ message: 'Token Azure AD invalido o expirado.' });
  }
}
