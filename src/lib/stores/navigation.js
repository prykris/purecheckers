import { writable, derived } from 'svelte/store';
import { NavigationController } from '../navigationController.js';
import { sendCommand } from './session.js';
import { api } from '../api.js';

const state = writable({ screen: 'none', tab: 'lobby', url: null, replayData: null, replayId: null, loading: false, error: null });
export const navigation = { subscribe: state.subscribe };
export const navigationController = new NavigationController({
  publish: value => state.set(value), sendCommand,
  loadReplay: async id => (await api.get('/leaderboard/game/' + id)).game,
});
export const browseTab = derived(navigation, state => state.tab);
export const gameScreen = derived(navigation, state => state.screen);
export const replayData = derived(navigation, state => state.replayData);
export const browseTo = tab => navigationController.browse(tab);
export const openSession = () => navigationController.openSession();
export const openReplay = id => navigationController.openReplay(id);
export const closeReplay = () => navigationController.closeReplay();
export const minimizeSession = () => navigationController.browse(navigationController.lastTab);
