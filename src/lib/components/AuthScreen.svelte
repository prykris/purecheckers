<script>
  import { onMount } from 'svelte';
  import { user, token } from '$lib/stores/user.js';
  import { api } from '$lib/api.js';

  let mode = 'login';
  let username = '';
  let email = '';
  let password = '';
  let error = '';
  let loading = false;
  let guestName = '';
  let showAuth = false;

  onMount(async () => {
    try {
      const data = await api.get('/guest/name');
      guestName = data.name;
    } catch {}
  });

  async function submit() {
    error = '';
    loading = true;
    try {
      let data;
      if (mode === 'register') {
        data = await api.post('/auth/register', { username, email, password });
      } else {
        data = await api.post('/auth/login', { email, password });
      }
      $token = data.token;
      $user = data.user;
    } catch (e) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  async function playAsGuest() {
    error = '';
    loading = true;
    try {
      const data = await api.post('/guest', { username: guestName });
      $token = data.token;
      $user = data.user;
    } catch (e) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  function toggle() {
    mode = mode === 'login' ? 'register' : 'login';
    error = '';
  }

  const boardCells = Array.from({ length: 64 }, (_, i) => {
    const row = Math.floor(i / 8);
    const col = i % 8;
    const isDark = (row + col) % 2 === 1;
    let piece = null;
    if (isDark && row < 3) piece = 'red';
    if (isDark && row > 4) piece = 'black';
    return { isDark, piece };
  });
</script>

<div class="page-center">
  <div class="auth-wrapper">
    <h1 class="logo"><span class="shimmer">Pure</span> Checkers</h1>

    <div class="board">
      {#each boardCells as cell}
        <div class="cell" class:dark={cell.isDark} class:light={!cell.isDark}>
          {#if cell.piece}
            <div class="piece" class:piece-red={cell.piece === 'red'} class:piece-black={cell.piece === 'black'}></div>
          {/if}
        </div>
      {/each}
    </div>

    <div class="hero-play">
      <input class="input guest-input" type="text" bind:value={guestName}
        placeholder="Enter a nickname" maxlength="20" />
      <button class="btn btn-primary play-btn" on:click={playAsGuest} disabled={loading}>
        {loading ? '...' : 'Play'}
      </button>
    </div>

    <button class="sign-in-link" on:click={() => showAuth = !showAuth}>
      {showAuth ? 'Hide' : 'Already have an account? Sign in'}
    </button>

    {#if showAuth}
      <div class="card auth-card">
        <h2>{mode === 'login' ? 'Welcome back' : 'Create account'}</h2>
        <form on:submit|preventDefault={submit}>
          {#if mode === 'register'}
            <input class="input" type="text" bind:value={username}
              placeholder="Username" maxlength="16" required autocomplete="username" />
          {/if}
          <input class="input" type="email" bind:value={email}
            placeholder="Email" required autocomplete="email" />
          <input class="input" type="password" bind:value={password}
            placeholder="Password" minlength="6" required
            autocomplete={mode === 'register' ? 'new-password' : 'current-password'} />
          {#if error}
            <p class="error">{error}</p>
          {/if}
          <button type="submit" class="btn btn-primary full-w" disabled={loading}>
            {loading ? '...' : mode === 'login' ? 'Log in' : 'Sign up'}
          </button>
        </form>
        <p class="toggle">
          {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}
          <button class="link" on:click={toggle}>
            {mode === 'login' ? 'Sign up' : 'Log in'}
          </button>
        </p>
      </div>
    {/if}
  </div>
</div>

<style>
  .auth-wrapper {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--sp-md);
    width: 100%;
    max-width: 380px;
  }

  .logo {
    font-size: var(--fs-title);
    letter-spacing: 2px;
    color: var(--text);
    text-align: center;
  }

  .shimmer {
    color: var(--accent);
    background: linear-gradient(
      120deg,
      var(--accent) 0%,
      #ff8a8a 40%,
      #fff 50%,
      #ff8a8a 60%,
      var(--accent) 100%
    );
    background-size: 200% 100%;
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
    animation: shimmer 2.5s ease-in-out forwards;
  }

  @keyframes shimmer {
    0% { background-position: 100% 0; }
    100% { background-position: -100% 0; }
  }

  .board {
    display: grid;
    grid-template-columns: repeat(8, 1fr);
    aspect-ratio: 1;
    width: min(300px, 50dvh, 80vw);
    flex-shrink: 1;
    min-height: 0;
    border-radius: var(--radius-md);
    overflow: hidden;
    box-shadow: 0 8px 40px rgba(0, 0, 0, 0.5);
  }

  .cell {
    aspect-ratio: 1;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .cell.light { background: #d4a76a; }
  .cell.dark { background: #7c5e3c; }

  .piece { width: 65%; height: 65%; border-radius: 50%; }
  .piece-red {
    background: radial-gradient(circle at 35% 35%, #f87171, #dc2626);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.4);
  }
  .piece-black {
    background: radial-gradient(circle at 35% 35%, #44403c, #1c1917);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.4);
  }

  .hero-play {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--sp-sm);
    width: 100%;
    max-width: 300px;
  }

  .guest-input {
    width: 100%;
    text-align: center;
    font-weight: 600;
    font-size: 1rem;
  }

  .play-btn {
    width: 100%;
    padding: var(--sp-md) var(--sp-xl);
    font-size: 1.2rem;
  }

  .sign-in-link {
    background: none;
    border: none;
    color: var(--text-dim);
    font-size: var(--fs-caption);
    cursor: pointer;
    text-decoration: underline;
    font-family: inherit;
  }
  .sign-in-link:hover { color: var(--text); }

  .auth-card {
    width: 100%;
    max-width: 300px;
    display: flex;
    flex-direction: column;
    gap: var(--sp-md);
    padding: var(--sp-lg) var(--sp-md);
  }
  .auth-card h2 { text-align: center; font-size: var(--fs-heading); }
  form { display: flex; flex-direction: column; gap: var(--sp-sm); }
  .full-w { width: 100%; }
  .error { color: var(--accent); font-size: var(--fs-caption); text-align: center; }
  .toggle { text-align: center; font-size: var(--fs-caption); color: var(--text-dim); }
  .link {
    background: none; border: none; color: var(--accent);
    cursor: pointer; font-size: var(--fs-caption); text-decoration: underline;
    font-family: inherit;
  }
</style>
