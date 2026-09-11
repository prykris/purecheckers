// A separate process proves recovery does not depend on a retained GameRoom.
import prisma from '../../server/db.js';
import { enqueueSettlement, createSettlementRecovery } from '../../server/services/settlementRecovery.js';

const [operation, payload] = process.argv.slice(2);
if (operation === 'enqueue-and-exit') {
  await enqueueSettlement(JSON.parse(payload));
  process.exit(23); // committed intent, no settlement and no graceful cleanup
}
const worker = createSettlementRecovery({ onSettled: async () => {
  if (operation === 'settle-and-exit') process.exit(24); // committed money, no publication
} });
const completed = await worker.runOnce();
await worker.stop();
await prisma.$disconnect();
process.stdout.write(JSON.stringify({ completed }));
