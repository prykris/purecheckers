import { positionHash, mirror } from '../../shared/puzzleSearch.js';

export const puzzlePositionKeys = position => [positionHash(position), positionHash(mirror(position))].sort();

export async function rejectedPuzzleHashes(db) {
  const rows = await db.puzzleRejection.findMany({ select: { positionHash: true, oppositeHash: true } });
  return new Set(rows.flatMap(row => [row.positionHash, row.oppositeHash]));
}

// Called under the shared publishing lock. Keep the strongest recorded failure;
// neither a retry nor a later shallow pass automatically clears this quarantine.
export async function recordPuzzleRejection(tx, { row, depth, reason, verifierVersion }) {
  if (!Number.isInteger(depth) || depth < 8 || depth > 12 || typeof reason !== 'string' || !reason
    || typeof verifierVersion !== 'string' || !verifierVersion) throw Error('Invalid puzzle rejection evidence');
  const [hash, oppositeHash] = puzzlePositionKeys(row.position);
  const existing = await tx.puzzleRejection.findUnique({ where: { positionHash: hash } });
  const data = { oppositeHash, sourceDate: row.date, verifiedDepth: depth, reason,
    generatorVersion: row.generatorVersion, verifierVersion };
  if (!existing) await tx.puzzleRejection.create({ data: { positionHash: hash, ...data } });
  else if (depth > existing.verifiedDepth) await tx.puzzleRejection.update({ where: { positionHash: hash }, data });
  return [hash, oppositeHash];
}
