import prisma from '../../server/db.js';
import { claimGameplayOwnership } from '../../server/services/gameplayOwnership.js';

const owner = await claimGameplayOwnership();
await prisma.$disconnect();
process.stdout.write(JSON.stringify(owner));
