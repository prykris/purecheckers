import '@sveltejs/kit/internal';
import './root-DaKe__1o.js';
import { w as writable } from './index-Dv3MCDRn.js';
import '@sveltejs/kit/internal/server';
import './state.svelte-Dz5XAtR1.js';

function create_updated_store() {
  const { set, subscribe } = writable(false);
  {
    return {
      subscribe,
      // eslint-disable-next-line @typescript-eslint/require-await
      check: async () => false
    };
  }
}
const stores = {
  updated: /* @__PURE__ */ create_updated_store()
};
function goto(url, opts = {}) {
  {
    throw new Error("Cannot call goto(...) on the server");
  }
}

export { goto as g, stores as s };
//# sourceMappingURL=client2-DeMnZtql.js.map
