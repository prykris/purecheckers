import { ReadResource } from './readResource.js';

// Read coordination belongs to this view; uncertain writes belong to the shared
// persistent journal, which remains available after leaving the shop.
export class ShopClient {
  constructor({ load, perform, readScope, isCurrent, publish }) {
    Object.assign(this, { perform, readScope, publish });
    this.state = { data: null, status: 'idle', readError: null, error: null, action: null };
    this.resource = new ReadResource({ load: async context => {
      const view = await load(context);
      if (!view || !Array.isArray(view.items) || !Array.isArray(view.inventory)) throw new Error('Could not confirm shop data. Please refresh.');
      return view;
    }, readScope, isCurrent, publish: value => {
      this.emit({ data: value.data, status: value.status, readError: value.error });
    } });
  }
  emit(patch) { this.state = { ...this.state, ...patch }; this.publish(this.state); }
  reset() { this.emit({ error: null, action: null }); this.resource.reset(); }
  dispose() { this.resource.dispose(); }
  async refresh() {
    if (this.resource.disposed || this.state.action) return false;
    this.emit({ error: null });
    return this.resource.refresh();
  }
  async act(kind, itemId, itemType = 'SKIN') {
    if (this.resource.disposed || this.state.action || this.state.status !== 'ready' || !['purchase', 'equip'].includes(kind)) return false;
    const item = this.state.data.items.find(item => item.id === itemId);
    const owned = this.state.data.inventory.some(row => row.itemId === itemId);
    const standardPieces = kind === 'equip' && itemId === null && ['SKIN', 'THEME'].includes(itemType);
    if (!standardPieces && (!item || (kind === 'purchase' ? owned : !owned || !['THEME', 'SKIN'].includes(item.type)))) return false;
    const scope = this.readScope();
    this.emit({ action: { kind, itemId, itemType }, error: null });
    try {
      const receipt = await this.perform(kind, standardPieces ? { itemId: null, itemType } : { itemId });
      if (!receipt || !this.resource.current(scope)) return false;
      const refreshed = await this.resource.refresh();
      if (!this.resource.current(scope)) return false;
      if (!refreshed) this.emit({ error: `${kind === 'equip' ? 'Item selection' : 'Purchase'} confirmed. Refresh to load your current items.` });
      return true;
    } catch (error) {
      if (this.resource.current(scope)) {
        this.emit({ error: error.message });
        await this.resource.refresh();
      }
      return false;
    } finally { if (this.resource.current(scope)) this.emit({ action: null }); }
  }
}
