import { Router } from 'express';
import { verifyToken } from '../middleware/auth.js';
import { getUserStatus } from '../socket/presenceHandler.js';
import { readFriends, executeFriendshipAction } from '../services/friendships.js';
import { FriendshipError, FRIENDSHIP_CHANGED } from '../../shared/friendshipActions.js';
import { notifyUser } from '../domain/events.js';
import { AccountError } from '../services/accounts.js';

const router = Router();
router.use(verifyToken);
router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
router.get('/', async (req, res) => {
  try { res.json(await readFriends(req.userId, getUserStatus)); }
  catch (error) { console.error('Friends read failed:', error.message); res.status(503).json({ error: 'Could not load friends. Please refresh.' }); }
});

function action(kind) {
  return async (req, res) => {
    try {
      const body = kind === 'remove' ? { ...req.body, friendshipId: /^\d+$/.test(req.params.id) ? Number(req.params.id) : null } : req.body;
      const receipt = await executeFriendshipAction(req.userId, kind, body);
      // Invalidation only: each participant re-reads their authenticated relationship list.
      for (const id of [receipt.friendship.requesterId, receipt.friendship.receiverId]) notifyUser(id, FRIENDSHIP_CHANGED, {});
      res.status(kind === 'request' ? 201 : 200).json(receipt);
    } catch (error) {
      if (error instanceof FriendshipError || error instanceof AccountError) return res.status(error.status).json({ error: error.message });
      console.error('Friendship action failed:', error.message);
      res.status(503).json({ error: 'Could not confirm the friendship action. Retry the same action.' });
    }
  };
}
router.post('/request', action('request'));
router.post('/accept', action('accept'));
router.delete('/:id', action('remove'));
export default router;
