export const JOIN_CODE_PATTERN = /^[A-Z2-9]{6}$/;

export function sameRoomSettings(a, b) {
  return !!a && !!b && ['buyIn', 'turnTimer', 'isPrivate', 'allowSpectators', 'autoReady'].every(key => a[key] === b[key]);
}

export function validRoomSettings({ buyIn, turnTimer, isPrivate, allowSpectators, autoReady }) {
  return Number.isSafeInteger(buyIn) && buyIn >= 0 && buyIn <= 2_147_483_647 &&
    [0, 30, 60, 90].includes(turnTimer) && typeof isPrivate === 'boolean' &&
    typeof allowSpectators === 'boolean' && typeof autoReady === 'boolean' && !(autoReady && buyIn > 0);
}
