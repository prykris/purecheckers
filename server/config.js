import 'dotenv/config';

export const PORT = process.env.PORT || 3001;
export const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';
export const JWT_EXPIRES_IN = '7d';
