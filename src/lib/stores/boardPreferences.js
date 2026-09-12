import { writable } from 'svelte/store';
const defaults = Object.freeze({hints:true,highlights:true,ratings:false,animations:true,reactions:true});
const key='checkers_board_preferences_v1';
function read() {
  try { const value=JSON.parse(globalThis.localStorage?.getItem(key)||'null');
    return Object.fromEntries(Object.entries(defaults).map(([k,v])=>[k,typeof value?.[k]==='boolean'?value[k]:v]));
  } catch { return {...defaults}; }
}
export const boardPreferences=writable(read());
boardPreferences.subscribe(value=>{try{globalThis.localStorage?.setItem(key,JSON.stringify(value));}catch{}});
export function toggleBoardPreference(key) { if(Object.hasOwn(defaults,key))boardPreferences.update(v=>({...v,[key]:!v[key]})); }
