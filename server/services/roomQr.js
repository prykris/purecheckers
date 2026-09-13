import QRCode from 'qrcode';
import { SITE_URL } from '../config.js';
export const roomQrCode = code => QRCode.toDataURL(`${SITE_URL}/invite/${code}`, { width: 768, margin: 2 });
