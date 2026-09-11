<script>
  // Emits a JSON-LD block. Svelte does not interpolate expressions inside a
  // <script> element in markup, so the block has to be injected as raw HTML.
  // Every "<" is escaped to the six characters \u003c: browsers decode it
  // inside the JSON, but the HTML parser never sees a tag. The replacement
  // string must be written as '\\u003c' (escaped backslash); a bare '\u003c'
  // literal in JS source is just "<" again and the replace would be a no-op.
  // With the escape in place, a username containing a closing script tag is
  // inert. (That tag cannot be spelled out in this comment either: it would
  // end this script block.)
  let { data } = $props();
  const json = $derived(JSON.stringify(data).replace(/</g, '\\u003c'));
</script>

<svelte:head>
  {@html '<script type="application/ld+json">' + json + '</scr' + 'ipt>'}
</svelte:head>
