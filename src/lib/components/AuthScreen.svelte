<script>
  import { onMount } from 'svelte';
  import { user, token } from '$lib/stores/user.js';
  import { api } from '$lib/api.js';

  let view = 'guest'; // 'guest' | 'login' | 'register'
  let username = '';
  let email = '';
  let password = '';
  let error = '';
  let loading = false;
  let guestName = '';

  onMount(async () => {
    try {
      const data = await api.get('/guest/name');
      guestName = data.name;
    } catch {}
  });

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

  async function submit() {
    error = '';
    loading = true;
    try {
      let data;
      if (view === 'register') {
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

  function switchTo(v) {
    view = v;
    error = '';
  }
</script>

<div class="page-center">
  <div class="auth-wrapper">
    <h1 class="logo"><span class="shimmer">Pure</span> Checkers</h1>

    {#if view === 'guest'}
      <p class="subtitle">Pick a name and play</p>
      <div class="form-area">
        <input class="input name-input" type="text" bind:value={guestName}
          placeholder="Enter a nickname" maxlength="20"
          onkeydown={(e) => e.key === 'Enter' && playAsGuest()} />
        {#if error}<p class="error">{error}</p>{/if}
        <button class="btn btn-primary play-btn" onclick={playAsGuest} disabled={loading}>
          {loading ? '...' : 'Play'}
        </button>
      </div>
      <button class="switch-link" onclick={() => switchTo('login')}>Already have an account? Sign in</button>

    {:else if view === 'login'}
      <p class="subtitle">Welcome back</p>
      <form class="form-area" onsubmit={(e) => { e.preventDefault(); submit(); }}>
        <input class="input" type="email" bind:value={email}
          placeholder="Email" required autocomplete="email" />
        <input class="input" type="password" bind:value={password}
          placeholder="Password" minlength="6" required autocomplete="current-password" />
        {#if error}<p class="error">{error}</p>{/if}
        <button type="submit" class="btn btn-primary play-btn" disabled={loading}>
          {loading ? '...' : 'Log in'}
        </button>
      </form>
      <div class="switch-row">
        <button class="switch-link" onclick={() => switchTo('guest')}>Play as guest</button>
        <span class="switch-sep">·</span>
        <button class="switch-link" onclick={() => switchTo('register')}>Create account</button>
      </div>

    {:else}
      <p class="subtitle">Create your account</p>
      <form class="form-area" onsubmit={(e) => { e.preventDefault(); submit(); }}>
        <input class="input" type="text" bind:value={username}
          placeholder="Username" maxlength="16" required autocomplete="username" />
        <input class="input" type="email" bind:value={email}
          placeholder="Email" required autocomplete="email" />
        <input class="input" type="password" bind:value={password}
          placeholder="Password (6+ chars)" minlength="6" required autocomplete="new-password" />
        {#if error}<p class="error">{error}</p>{/if}
        <button type="submit" class="btn btn-primary play-btn" disabled={loading}>
          {loading ? '...' : 'Sign up'}
        </button>
      </form>
      <div class="switch-row">
        <button class="switch-link" onclick={() => switchTo('guest')}>Play as guest</button>
        <span class="switch-sep">·</span>
        <button class="switch-link" onclick={() => switchTo('login')}>Already have an account?</button>
      </div>
    {/if}
  </div>
</div>

<style>
  .auth-wrapper {
    display: flex; flex-direction: column; align-items: center;
    gap: var(--sp-lg); width: 100%; max-width: 320px;
    padding: var(--sp-md);
  }

  .logo {
    font-size: var(--fs-title); letter-spacing: 2px;
    color: var(--text); text-align: center;
  }
  .shimmer {
    color: var(--accent);
    background: linear-gradient(120deg, var(--accent) 0%, #ff8a8a 40%, #fff 50%, #ff8a8a 60%, var(--accent) 100%);
    background-size: 200% 100%;
    -webkit-background-clip: text; background-clip: text;
    -webkit-text-fill-color: transparent;
    animation: shimmer 2.5s ease-in-out forwards;
  }
  @keyframes shimmer { 0% { background-position: 100% 0; } 100% { background-position: -100% 0; } }

  .subtitle {
    font-size: var(--fs-body); color: var(--text-dim); text-align: center;
    margin-top: calc(-1 * var(--sp-sm));
  }

  .form-area {
    display: flex; flex-direction: column; gap: var(--sp-sm);
    width: 100%;
  }

  .name-input {
    text-align: center; font-weight: 600; font-size: 1rem;
  }

  .play-btn {
    width: 100%; padding: var(--sp-md); font-size: 1.1rem;
  }

  .error { color: var(--accent); font-size: var(--fs-caption); text-align: center; }

  .switch-link {
    background: none; border: none; color: var(--text-dim);
    font-size: var(--fs-caption); font-family: var(--font);
    cursor: pointer; text-decoration: underline;
    transition: color 0.15s;
  }
  .switch-link:hover { color: var(--text); }

  .switch-row {
    display: flex; align-items: center; gap: var(--sp-sm);
  }
  .switch-sep { color: var(--text-dim); opacity: 0.4; }
</style>
