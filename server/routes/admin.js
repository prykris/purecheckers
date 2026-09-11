import { Router } from 'express';
import { verifyToken } from '../middleware/auth.js';
import { EconomyError } from '../services/economy.js';
import { ADMIN_ACTIONS, AdminActionError } from '../../shared/adminActions.js';
import { executeAdminAction } from '../services/adminActions.js';

const router = Router();
for (const kind of ADMIN_ACTIONS) {
  router.post('/' + kind, verifyToken, async (req, res) => {
    try { res.json(await executeAdminAction(req.userId, kind, req.body)); }
    catch (error) {
      if (error instanceof AdminActionError || error instanceof EconomyError) return res.status(error.status).json({ error: error.message });
      console.error('Admin action failed:', error.message);
      res.status(503).json({ error: 'Admin action could not be confirmed. Retry the same request.' });
    }
  });
}
export default router;
