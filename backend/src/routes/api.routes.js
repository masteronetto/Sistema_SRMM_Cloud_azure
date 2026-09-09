import { Router } from 'express';
import { requireAzureToken } from '../middleware/azureAuth.js';

const router = Router();

router.get('/me', requireAzureToken, (req, res) => {
  const roles = Array.isArray(req.auth.roles)
    ? req.auth.roles
    : req.auth.role
      ? [req.auth.role]
      : [];

  res.json({
    subject: req.auth.oid || req.auth.sub,
    name: req.auth.name || null,
    scopes: req.auth.scp || '',
    roles,
    tokenVersion: req.auth.ver || null,
    tenantId: req.auth.tid || null,
    applicationId: req.auth.azp || req.auth.appid || null,
    audience: req.auth.aud || null
  });
});

export default router;
