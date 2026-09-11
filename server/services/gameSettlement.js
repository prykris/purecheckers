import { calculateElo } from './elo.js';
import { gameResultCode } from '../../shared/gameResult.js';
import { releaseGamePlayers } from './gameMembership.js';
import { awardCoins } from './coins.js';
import { calculateRankedPayout, depositToVault, awardDailyBounty, checkMilestones, isValidWager } from './vault.js';
import { assertCoinAmount, inEconomyTransaction, lockEconomyUsers } from './economy.js';
import {
  COINS_RANKED_WIN, COINS_LOSS, COINS_BOT_WIN, BOT_WIN_DAILY_CAP,
  MAX_DAILY_WINS_VS_SAME, GUEST_LIFETIME_MS
} from '../../shared/constants.js';

// One committed record is the receipt for replay, statistics and every reward.
// Repeating a settlement key returns that receipt without repeating effects.
export function settleGame(intent, transaction = null) {
  const { key, redUserId, blackUserId, winner, mode, buyIn, moveHistory, startedAt, endedAt, endReason } = structuredClone(intent);
  if (!key || typeof key !== 'string' || key.length > 100 || redUserId === blackUserId
    || ![null, 'red', 'black'].includes(winner) || !['RANKED', 'FRIENDLY', 'BOT'].includes(mode)) {
    throw new Error('Invalid game settlement');
  }
  assertCoinAmount(buyIn);
  const result = gameResultCode(winner, endReason);
  if (result === 'ABORTED' && winner !== null) throw new Error('An aborted game cannot have a winner');
  if (mode !== 'RANKED' && buyIn !== 0) throw new Error('Only ranked games can have a wager');
  return inEconomyTransaction(transaction, async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${'game-settlement:' + key}, 0))`;
    const existing = await tx.game.findUnique({ where: { settlementKey: key } });
    if (existing) {
      if (existing.redPlayerId !== redUserId || existing.blackPlayerId !== blackUserId
        || existing.winnerId !== (winner === 'red' ? redUserId : winner === 'black' ? blackUserId : null)
        || existing.result !== result || existing.mode !== mode || existing.settlement?.wagerBuyIn !== buyIn) throw new Error('Settlement identity conflict');
      return { replayId: existing.id, ...existing.settlement };
    }
    await lockEconomyUsers(tx, [redUserId, blackUserId]);
    const run = await tx.gameRun.findUnique({ where: { key } });
    if (run && (run.status !== 'OPEN' || run.redPlayerId !== redUserId || run.blackPlayerId !== blackUserId || run.mode !== mode || run.buyIn !== buyIn)) throw new Error('Game reservation identity conflict');
    if (buyIn > 0 && !run) throw new Error('Wager has no durable reservation');
    const red = await tx.user.findUniqueOrThrow({ where: { id: redUserId } });
    const black = await tx.user.findUniqueOrThrow({ where: { id: blackUserId } });
    const users = { red, black }, loser = winner === 'red' ? 'black' : 'red';
    const winnerId = winner ? users[winner].id : null;
    const now = new Date(), day = new Date(now); day.setUTCHours(0, 0, 0, 0);
    const receipt = {
      result, winnerId, eloChanges: { red: 0, black: 0 }, eloDetail: {},
      coinRewards: { red: 0, black: 0 }, coinBreakdown: { red: [], black: [] },
      milestones: { red: [], black: [] }, settledAt: now.toISOString(), wagerBuyIn: buyIn
    };
    async function credit(color, amount, label, reason = 'WIN_REWARD') {
      if (amount > 0) await awardCoins(users[color].id, amount, reason, tx, now);
      receipt.coinRewards[color] += amount;
      receipt.coinBreakdown[color].push({ label, amount });
    }
    async function refund() {
      if (buyIn > 0) for (const color of ['red', 'black']) await credit(color, buyIn, 'Wager refund', 'WAGER_REFUND');
    }

    if (result === 'ABORTED') {
      await refund();
    } else if (mode === 'RANKED') {
      if (red.isBot || black.isBot || red.isGuest || black.isGuest) throw new Error('Ranked settlement requires registered human players');
      receipt.eloDetail = { red: { opponentElo: black.elo }, black: { opponentElo: red.elo } };
      if (winner) {
        const { winnerDelta, loserDelta } = calculateElo(users[winner].elo, users[loser].elo, users[winner].gamesPlayed, users[loser].gamesPlayed);
        receipt.eloChanges[winner] = winnerDelta; receipt.eloChanges[loser] = loserDelta;
        const priorWins = MAX_DAILY_WINS_VS_SAME > 0 ? await tx.game.count({ where: {
          winnerId, endedAt: { gte: day }, OR: [
            { redPlayerId: winnerId, blackPlayerId: users[loser].id },
            { blackPlayerId: winnerId, redPlayerId: users[loser].id }
          ]
        } }) : 0;
        const diminished = MAX_DAILY_WINS_VS_SAME > 0 && priorWins >= MAX_DAILY_WINS_VS_SAME;
        if (!diminished) await credit(winner, COINS_RANKED_WIN, 'Win reward');
        let tax = 0;
        if (buyIn > 0 && isValidWager(moveHistory, startedAt, endedAt)) {
          const payout = calculateRankedPayout(buyIn);
          tax = diminished ? buyIn * 2 : payout.tax;
          if (!diminished) await credit(winner, payout.winnerPot, 'Wager pot');
          await depositToVault(tax, diminished ? 'Anti-farm tax' : 'Ranked tax', `Game ${key}`, tx);
        } else await refund();
        receipt.coinRewards.tax = tax;
        await credit(loser, COINS_LOSS, 'Consolation');
      } else {
        if (red.elo !== black.elo) receipt.eloChanges = red.elo < black.elo ? { red: 2, black: -2 } : { red: -2, black: 2 };
        for (const color of ['red', 'black']) await credit(color, COINS_LOSS, 'Draw consolation');
        await refund();
      }
    } else if (winner && users[loser].isBot && !users[winner].isBot) {
      const awarded = await tx.coinTransaction.count({ where: { receiverId: winnerId, reason: 'BOT_WIN', createdAt: { gte: day } } });
      if (awarded < BOT_WIN_DAILY_CAP) await credit(winner, COINS_BOT_WIN, 'Bot win', 'BOT_WIN');
      else await credit(winner, 0, 'Daily bot-win limit reached');
    }

    if (result !== 'ABORTED') for (const color of ['red', 'black']) {
      await tx.user.update({ where: { id: users[color].id }, data: {
        elo: { increment: receipt.eloChanges[color] }, gamesPlayed: { increment: 1 },
        wins: winner === color ? { increment: 1 } : undefined,
        losses: winner && winner !== color ? { increment: 1 } : undefined,
        guestExpiresAt: users[color].isGuest ? new Date(now.getTime() + GUEST_LIFETIME_MS) : undefined
      } });
    }
    if (mode === 'RANKED' && winner) {
      const bonus = await awardDailyBounty(winnerId, tx, now);
      receipt.coinRewards.dailyBonus = Math.max(0, bonus);
      receipt.coinRewards[winner] += Math.max(0, bonus);
      if (bonus !== 0) receipt.coinBreakdown[winner].push({ label: bonus > 0 ? 'Daily bonus' : 'Daily bonus (pending)', amount: Math.max(0, bonus) });
      const milestones = await checkMilestones(winnerId, users[winner].elo + receipt.eloChanges[winner], tx);
      receipt.milestones[winner] = milestones;
      for (const m of milestones) {
        receipt.coinRewards[winner] += m.pending ? 0 : m.reward;
        receipt.coinBreakdown[winner].push({ label: `${m.name} milestone${m.pending ? ' (pending)' : ''}`, amount: m.pending ? 0 : m.reward });
      }
    }
    const saved = await tx.game.create({ data: {
      settlementKey: key, settlement: receipt, redPlayerId: redUserId, blackPlayerId: blackUserId,
      winnerId, result, mode, moveHistory, startedAt: new Date(startedAt), endedAt: new Date(endedAt), endReason,
      redEloChange: receipt.eloChanges.red, blackEloChange: receipt.eloChanges.black,
      redCoinsEarned: receipt.coinRewards.red, blackCoinsEarned: receipt.coinRewards.black
    } });
    if (run) {
      await tx.gameRun.update({ where: { key }, data: { status: 'SETTLED', closedAt: now, replayId: saved.id } });
      await releaseGamePlayers(tx, run.id);
    }
    return { replayId: saved.id, ...receipt };
  });
}
