<script>
  import { onMount } from 'svelte';
  import { screen } from '../stores/app.js';
  import { user, token } from '../stores/user.js';
  import { api } from '../lib/api.js';
  import { connectSocket } from '../lib/socket.js';

  let mode = 'login';
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
      connectSocket();
      $screen = 'lobby';
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
      $user = { id: data.guest.id, username: data.guest.username, isGuest: true, elo: 1000, coins: 0 };
      connectSocket();
      $screen = 'lobby';
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
</script>

<div class="page-center">
  <div class="auth-wrapper">
    <h1 class="title">Checkers <span>Online</span></h1>

    <!-- Guest quick play -->
    <div class="card guest-card">
      <input class="input guest-input" type="text" bind:value={guestName}
        placeholder="Nickname" maxlength="20" />
      <button class="btn btn-primary full-w" on:click={playAsGuest} disabled={loading}>
        {loading ? '...' : 'Play as Guest'}
      </button>
    </div>

    <div class="divider"><span>or</span></div>

    <!-- Full auth -->
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
  .title { font-size: var(--fs-title); letter-spacing: 2px; color: var(--accent); }
  .title span { color: var(--text); font-weight: 300; }

  .guest-card {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: var(--sp-sm);
    padding: var(--sp-md);
  }
  .guest-input {
    text-align: center;
    font-weight: 600;
    font-size: 1rem;
  }

  .divider {
    display: flex;
    align-items: center;
    gap: var(--sp-sm);
    width: 100%;
    color: var(--text-dim);
    font-size: var(--fs-caption);
  }
  .divider::before, .divider::after {
    content: '';
    flex: 1;
    height: 1px;
    background: var(--surface2);
  }

  .auth-card {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: var(--sp-md);
    padding: var(--sp-lg) var(--sp-md);
  }
  h2 { text-align: center; font-size: var(--fs-heading); }
  form { display: flex; flex-direction: column; gap: var(--sp-sm); }
  .full-w { width: 100%; }
  .error { color: var(--accent); font-size: var(--fs-caption); text-align: center; }
  .toggle { text-align: center; font-size: var(--fs-caption); color: var(--text-dim); }
  .link {
    background: none; border: none; color: var(--accent);
    cursor: pointer; font-size: var(--fs-caption); text-decoration: underline;
  }
</style>
