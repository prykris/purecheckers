import 'dotenv/config';
import { networkInterfaces } from 'os';

export const PORT = process.env.PORT || 3001;
export const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';
export const JWT_EXPIRES_IN = '7d';

// Public URL for QR codes / invite links
// In production: set SITE_URL in .env (e.g. https://checkers.yourdomain.com)
// In dev: auto-detect LAN IP
function detectLanIp() {
  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return 'localhost';
}

const CLIENT_PORT = process.env.CLIENT_PORT || 3000;
export const SITE_URL = process.env.SITE_URL || `http://${detectLanIp()}:${CLIENT_PORT}`;
