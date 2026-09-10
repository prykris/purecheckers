// Outbound ports. The application installs a transport; domain rules never import it.
let ports = { publishUser() {}, publishGame() {}, broadcast() {}, notifyChannel() {}, notifyUser() {} };
export function configureEvents(next) { ports = next; }
export const publishUser = userId => ports.publishUser(userId);
export const publishGame = gameId => ports.publishGame(gameId);
export const broadcast = (event, data) => ports.broadcast(event, data);
export const notifyChannel = (channel, event, data) => ports.notifyChannel(channel, event, data);
export const notifyUser = (userId, event, data) => ports.notifyUser(userId, event, data);
