import { Router } from 'express';
import { requireAzureToken } from '../middleware/azureAuth.js';

const router = Router();

router.get('/me', requireAzureToken, (req, res) => {
  res.json({
    subject: req.auth.oid || req.auth.sub,
    name: req.auth.name || null,
    scopes: req.auth.scp || '',
    roles: req.auth.roles || []
  });
});

export default router;
