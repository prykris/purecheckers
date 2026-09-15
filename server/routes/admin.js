import { Router } from 'express';
import { readAdmin } from '../services/adminRead.js';
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
for (const path of ['/:section', '/:section/:id']) router.get(path, verifyToken, async (req, res) => {
  res.set('Cache-Control', 'no-store');
  try { res.json(await readAdmin(req.userId, req.params.section, req.params.id, req.query)); }
  catch (error) {
    if (error instanceof AdminActionError) return res.status(error.status).json({ error: error.message });
    console.error('Admin lookup failed:', error.message);
    res.status(503).json({ error: 'Admin data is unavailable. Please retry.' });
  }
});
export default router;
