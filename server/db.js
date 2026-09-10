import { PrismaClient } from '@prisma/client';

// One PrismaClient for the whole server. Each client owns a PostgreSQL
// connection pool, so creating one per module would multiply connections.
const prisma = new PrismaClient();

export default prisma;
