import { x as noop } from './index2-XvOMkuwj.js';
import './root-DaKe__1o.js';
import '@sveltejs/kit/internal/server';

const is_legacy = noop.toString().includes("$$") || /function \w+\(\) \{\}/.test(noop.toString());
const placeholder_url = "a:";
if (is_legacy) {
  ({
    url: new URL(placeholder_url)
  });
}
//# sourceMappingURL=state.svelte-Dz5XAtR1.js.map
