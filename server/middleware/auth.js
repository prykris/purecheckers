import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config.js';
import { authorizeAccount, AccountError } from '../services/accounts.js';

export function optionalToken(req, res, next) {
  if (!req.headers.authorization) return next();
  return verifyToken(req, res, next);
}

export async function verifyToken(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  let payload;
  try {
    const token = header.slice(7);
    payload = jwt.verify(token, JWT_SECRET);
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
  try {
    const user = await authorizeAccount(payload.userId);
    req.userId = user.id;
    req.username = user.username;
    req.isGuest = !!user.isGuest;
    // Signed metadata is only used to detect an obsolete token, never for access.
    req.tokenIdentity = { username: payload.username, isGuest: !!payload.isGuest };
    req.tokenExpiresAt = typeof payload.exp === 'number' ? payload.exp * 1000 : null; // ms, for token renewal
    next();
  } catch (error) {
    if (error instanceof AccountError) return res.status(error.status).json({ error: error.message });
    console.error('Account authorization unavailable:', error.message);
    return res.status(503).json({ error: 'Account lookup is temporarily unavailable. Please retry.' });
  }
}
