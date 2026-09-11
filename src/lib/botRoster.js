import { ReadResource } from './readResource.js';
import { parseBotRoster } from '../../shared/bots.js';

// Public presentation belongs to the mounted picker. Reopening refreshes it;
// gameplay admission and remembered difficulty never depend on this read.
export function createBotRoster({ request, publish }) {
  return new ReadResource({
    load: async ({ signal }) => parseBotRoster(await request('/bots', { signal, authToken: null })),
    readScope: () => null,
    isCurrent: () => true,
    publish
  });
}
