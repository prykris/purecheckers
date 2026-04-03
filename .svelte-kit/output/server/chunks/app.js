import { w as writable } from "./index.js";
const phase = writable("idle");
const gameState = writable(null);
const activeRoom = writable(null);
const searching = writable(false);
const presenceStats = writable({ online: 0, lookingToPlay: 0 });
const roomChatMessages = writable([]);
const roomUnreadChat = writable(0);
export {
  activeRoom as a,
  presenceStats as b,
  roomChatMessages as c,
  gameState as g,
  phase as p,
  roomUnreadChat as r,
  searching as s
};
