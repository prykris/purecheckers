import { commitGameTransition } from '../../server/services/gameTransitions.js';

const { options, checkpoint, owner } = JSON.parse(process.argv[2]);
await commitGameTransition(options, () => checkpoint, null, owner);
process.exit(26); // transition committed; no room installation or acknowledgement
