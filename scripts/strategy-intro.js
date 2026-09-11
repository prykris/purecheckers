// Authoring policy: a strategy article introduces its subject before offering
// play. Insert the shared component into the Markdown tree, never the live DOM.
export function strategyIntro() {
  return (tree, file) => {
    const filename = String(file.filename ?? '').replaceAll('\\', '/');
    const match = filename.match(/(?:^|\/)src\/content\/strategy\/([a-z0-9]+(?:-[a-z0-9]+)*)\.md$/);
    if (!match) return;
    const heading = tree.children.findIndex(node => node.type === 'heading' && node.depth === 2);
    if (heading < 0 || !tree.children.slice(0, heading).some(node => node.type === 'paragraph')) {
      throw new Error(`${filename}: an article needs an introduction before its first H2`);
    }
    const script = tree.children.find(node => node.type === 'html' && /^<script\s*>/.test(node.value));
    const declaration = "import StrategyIntroPlay from '$lib/components/ArticlePlayLink.svelte';";
    tree.children.splice(heading, 0, { type: 'html', value: `<StrategyIntroPlay slug="${match[1]}" />` });
    if (script) script.value = script.value.replace(/^<script\s*>/, `<script>\n${declaration}\n`);
    else tree.children.unshift({ type: 'html', value: `<script>\n${declaration}\n</script>` });
  };
}
