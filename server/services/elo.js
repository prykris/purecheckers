import { ELO_K_NEW, ELO_K_EXPERIENCED, ELO_NEW_THRESHOLD } from '../../shared/constants.js';

export function calculateElo(winnerRating, loserRating, winnerGames, loserGames) {
  const kWinner = winnerGames < ELO_NEW_THRESHOLD ? ELO_K_NEW : ELO_K_EXPERIENCED;
  const kLoser = loserGames < ELO_NEW_THRESHOLD ? ELO_K_NEW : ELO_K_EXPERIENCED;

  const expectedWinner = 1 / (1 + Math.pow(10, (loserRating - winnerRating) / 400));
  const expectedLoser = 1 - expectedWinner;

  const winnerDelta = Math.round(kWinner * (1 - expectedWinner));
  const loserDelta = Math.round(kLoser * (0 - expectedLoser));

  return { winnerDelta, loserDelta };
}
