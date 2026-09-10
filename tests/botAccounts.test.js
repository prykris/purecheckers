import { PrismaClient } from '@prisma/client';
import { BOT_REGISTRY, getBotDefinition } from '../server/domain/botRegistry.js';
import { ensureBotAccount, ensurePredefinedBots, BotAccountConflict } from '../server/services/botAccounts.js';
import { getBotDifficulty } from '../server/services/botPlayer.js';

const prisma = new PrismaClient();
beforeEach(async () => {
  await prisma.game.deleteMany(); await prisma.coinTransaction.deleteMany();
  await prisma.inventory.deleteMany(); await prisma.friendship.deleteMany();
  await prisma.pendingPayout.deleteMany(); await prisma.user.deleteMany();
});
afterAll(() => prisma.$disconnect());

describe('predefined bot accounts', () => {
  it('provisions every registry entry without a seed and is idempotent', async () => {
    const first = await ensurePredefinedBots(prisma), second = await ensurePredefinedBots(prisma);
    expect(first.map(bot => bot.id)).toEqual(second.map(bot => bot.id));
    expect(await prisma.user.count()).toBe(Object.keys(BOT_REGISTRY).length);
    for (const bot of first) {
      expect(bot.isBot).toBe(true); expect(bot.isGuest).toBe(false);
      expect(bot.elo).toBe(BOT_REGISTRY[bot.botKey].initialElo);
      expect(bot.passwordHash).toBeNull(); expect(await getBotDifficulty(bot.id)).toBe(bot.botKey);
    }
  });
  it('coordinates concurrent creators from separate clients without duplicate accounts', async () => {
    const secondClient = new PrismaClient();
    try {
      const bots = await Promise.all(Array.from({ length: 8 }, (_, i) => ensureBotAccount(i % 2 ? prisma : secondClient, 'medium')));
      expect(new Set(bots.map(bot => bot.id)).size).toBe(1); expect(await prisma.user.count()).toBe(1);
    } finally { await secondClient.$disconnect(); }
  });
  it('preserves the stable identity and accumulated stats after a display-name change', async () => {
    const bot = await ensureBotAccount(prisma, 'easy');
    await prisma.user.update({ where: { id: bot.id }, data: { username: 'Renamed Easy', elo: 777, peakElo: 900, coins: 12, gamesPlayed: 4, wins: 2 } });
    const again = await ensureBotAccount(prisma, 'easy');
    expect(again).toMatchObject({ id: bot.id, username: 'Renamed Easy', elo: 777, peakElo: 900, coins: 12, gamesPlayed: 4, wins: 2 });
    expect(await getBotDifficulty(bot.id)).toBe('easy');
  });
  it('adopts an existing seeded bot without replacing it or resetting its stats', async () => {
    const existing = await prisma.user.create({ data: { username: 'Bot Hard', friendCode: 'existing-bot', isBot: true, elo: 1501, gamesPlayed: 9 } });
    const bot = await ensureBotAccount(prisma, 'hard');
    expect(bot).toMatchObject({ id: existing.id, botKey: 'hard', elo: 1501, gamesPlayed: 9, friendCode: 'existing-bot' });
  });
  it('never converts or overwrites a human account with a matching name', async () => {
    const human = await prisma.user.create({ data: { username: 'Bot Easy', friendCode: 'human', coins: 45 } });
    await expect(ensureBotAccount(prisma, 'easy')).rejects.toBeInstanceOf(BotAccountConflict);
    expect(await prisma.user.findUnique({ where: { id: human.id } })).toEqual(human);
  });
  it('rejects accounts with credentials or elevated privileges even if flagged as bots', async () => {
    for (const data of [{ passwordHash: 'credential' }, { email: 'test@example.test' }, { isAdmin: true }, { isGuest: true }]) {
      const account = await prisma.user.create({ data: { username: 'Bot Easy', friendCode: 'conflict', isBot: true, ...data } });
      await expect(ensureBotAccount(prisma, 'easy')).rejects.toBeInstanceOf(BotAccountConflict);
      await prisma.user.delete({ where: { id: account.id } });
    }
  });
  it('does not serve a stale cached account after it has been removed', async () => {
    const first = await ensureBotAccount(prisma, 'easy'); await prisma.user.delete({ where: { id: first.id } });
    const replacement = await ensureBotAccount(prisma, 'easy'); expect(replacement.id).not.toBe(first.id);
    expect(await prisma.user.count()).toBe(1);
  });
  it('rejects arbitrary and prototype-property keys without database writes', async () => {
    for (const key of ['__proto__', 'constructor', 'toString', 'missing', '', null, {}, ['easy']]) {
      expect(getBotDefinition(key)).toBeNull(); expect(await ensureBotAccount(prisma, key)).toBeNull();
    }
    expect(await prisma.user.count()).toBe(0);
  });
  it('propagates database failures instead of pretending that provisioning succeeded', async () => {
    const failure = Object.assign(new Error('Database unavailable'), { code: 'P1001' });
    const database = { $transaction: vi.fn().mockRejectedValue(failure) };
    await expect(ensureBotAccount(database, 'easy')).rejects.toBe(failure);
    expect(database.$transaction).toHaveBeenCalledOnce();
  });
});
