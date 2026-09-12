import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve, basename } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { compile } from 'svelte/compiler';
import { render } from 'svelte/server';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let GameResult, state;
beforeAll(async () => {
  const output = resolve(root, 'node_modules/.cache/result-sheet-test');
  const fixture = pathToFileURL(resolve(output, 'state.js')).href;
  mkdirSync(output, { recursive: true });
  writeFileSync(resolve(output, 'state.js'), readFileSync(resolve(root, 'tests/fixtures/resultSheetState.js'), 'utf8'));
  state = await import(fixture);
  for (const name of ['GameResult', 'ShareActions', 'ReplayBoard', 'PlayerLink', 'GameBoard', 'BoardView', 'table/TableIcon']) {
    const source = resolve(root, `src/lib/components/${name}.svelte`);
    const { js } = compile(readFileSync(source, 'utf8'), { generate: 'server', filename: source });
    const code = js.code.replace(/from (['"])([^'"]+)\1/g, (match, quote, specifier) => {
      if (specifier.startsWith('$lib/stores/') || specifier === '$lib/analytics.js') return `from '${fixture}'`;
      if (!specifier.startsWith('.') && !specifier.startsWith('$lib/')) return match;
      const target = specifier.endsWith('.svelte') ? resolve(output, basename(specifier, '.svelte') + '.js')
        : specifier.startsWith('$lib/') ? resolve(root, 'src/lib', specifier.slice(5)) : resolve(dirname(source), specifier);
      return `from ${quote}${pathToFileURL(target).href}${quote}`;
    });
    writeFileSync(resolve(output, `${basename(name)}.js`), code);
  }
  GameResult = (await import(pathToFileURL(resolve(output, 'GameResult.js')).href)).default;
});

function sheet({ origin = 'bot', guest = false, searching = 0, changes = {}, status = 'ready', pending = null } = {}) {
  state.user.set({ id: 1, username: 'You', isGuest: guest });
  state.session.set({ status, pending }); state.presenceStats.set({ searching });
  state.gameState.set({ myColor: 'red', opponentId: 2, opponentName: 'Chris', state: {
    gameId: 10, gameOver: true, origin, botDifficulty: 'hard', mode: 'FRIENDLY', winner: 'red',
    moveHistory: [], persistStatus: 'saved', ...changes
  } });
  return render(GameResult, { props: { onchat: () => {}, unread: 2 } }).body;
}
function buttons(body) {
  return [...body.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)].map(([, attrs, contents]) => ({
    text: contents.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim(),
    disabled: /\bdisabled(?:\s|=|$)/.test(attrs)
  }));
}

it.each([
  ['bot', false, ['Play again · Hard', 'Play with a friend', 'Lobby']],
  ['bot', true, ['Play again · Hard', 'Play with a friend', 'Lobby', 'Save account']],
  ['quickplay', false, ['Rematch', 'Play with a friend', 'Lobby', 'Chat2']],
  ['quickplay', true, ['Rematch', 'Lobby', 'Chat2', 'Save account']],
  ['room', false, ['Rematch', 'Lobby', 'Chat2']],
  ['room', true, ['Rematch', 'Save account Keep You and your games', 'Lobby', 'Chat2']]
])('renders the approved result actions for %s, guest=%s', (origin, guest, expected) => {
  const actions = buttons(sheet({ origin, guest })).filter(b => b.text && !['Saving replay…', 'Copy link', 'Replay game'].includes(b.text));
  expect(actions.map(b => b.text)).toEqual(expected);
});

it.each(['bot', 'quickplay', 'room'])('offers human search only where the matrix permits it: %s', origin => {
  expect(sheet({ origin, searching: 0 })).not.toContain('Find Opponent');
  expect(sheet({ origin, searching: 3 }).includes('Find Opponent')).toBe(origin !== 'room');
});

it('uses the finished bot difficulty even when the remembered lobby preference changes', () => {
  state.botDifficulty.set('easy'); expect(sheet()).toContain('Play again · Hard');
  state.botDifficulty.set('medium'); expect(sheet()).toContain('Play again · Hard');
  expect(sheet({ changes: { botDifficulty: null } })).toContain('Play again · Medium');
});

it.each([
  [{ rematchRequests: [1] }, 'Waiting for Chris…', true],
  [{ rematchRequests: [2] }, 'Accept rematch', false],
  [{ opponentLeft: true }, 'Chris left', true],
  [{ rematchPending: true }, 'Starting rematch…', true]
])('renders rematch consent and availability from accepted state: %j', (changes, text, disabled) => {
  expect(buttons(sheet({ origin: 'room', changes })).find(b => b.text === text)).toEqual({ text, disabled });
});

it.each([{ status: 'reconnecting' }, { pending: 'bot:play' }])('disables session commands while recovery or another command is pending: %j', context => {
  const actions = buttons(sheet({ ...context, searching: 3, guest: true }));
  expect(actions.filter(b => /^(Play again|Starting…|Play with a friend|Find Opponent|Lobby)/.test(b.text)).every(b => b.disabled)).toBe(true);
  expect(actions.find(b => b.text === 'Save account').disabled).toBe(false);
});


it('gives spectators a neutral result and sharing/leave actions without player rewards or rematches', () => {
  state.user.set({id:3,username:'Watcher',isGuest:false});
  state.session.set({status:'ready',pending:null});
  const view={mode:'spectator',roomId:8,spectatorRedName:'Red player',spectatorBlackName:'Black player',state:{
    gameId:10,gameOver:true,origin:'room',mode:'RANKED',winner:'red',moveHistory:[],persistStatus:'saved',
    resultData:{result:'RED_WIN',replayId:10,eloChanges:{red:12,black:-12},coinRewards:{red:4}}
  }};
  const body=render(GameResult,{props:{view}}).body;
  expect(body).toContain('Red player wins');
  expect(body).not.toContain('You won');expect(body).not.toContain('You lost');
  expect(body).not.toContain('+12 ELO');expect(body).not.toContain('+4 coins');
  expect(buttons(body).some(b=>/Rematch|Save account|Play again/.test(b.text))).toBe(false);
  expect(buttons(body).some(b=>b.text==='Lobby')).toBe(true);
  expect(body).toContain('Share result');
});
