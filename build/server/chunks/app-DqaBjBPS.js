import { w as writable } from './index-Dv3MCDRn.js';

const phase = writable("idle");
const gameState = writable(null);
const activeRoom = writable(null);
const searching = writable(false);
const presenceStats = writable({ online: 0, lookingToPlay: 0 });
const roomChatMessages = writable([]);
const roomUnreadChat = writable(0);

export { activeRoom as a, phase as b, roomChatMessages as c, gameState as g, presenceStats as p, roomUnreadChat as r, searching as s };
//# sourceMappingURL=app-DqaBjBPS.js.map
