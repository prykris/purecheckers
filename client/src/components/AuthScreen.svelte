<script>
  import { screen } from '../stores/app.js';
  import { user, token } from '../stores/user.js';
  import { api } from '../lib/api.js';
  import { connectSocket } from '../lib/socket.js';

  let mode = 'login'; // 'login' | 'register'
  let username = '';
  let email = '';
  let password = '';
  let error = '';
  let loading = false;

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

  function toggle() {
    mode = mode === 'login' ? 'register' : 'login';
    error = '';
  }
</script>

<div class="auth-screen">
  <h1 class="title">Checkers <span>Online</span></h1>
  <div class="auth-box">
    <h2>{mode === 'login' ? 'Welcome back' : 'Create account'}</h2>

    <form on:submit|preventDefault={submit}>
      {#if mode === 'register'}
        <input
          type="text"
          bind:value={username}
          placeholder="Username"
          maxlength="16"
          required
          autocomplete="username"
        />
      {/if}

      <input
        type="email"
        bind:value={email}
        placeholder="Email"
        required
        autocomplete="email"
      />

      <input
        type="password"
        bind:value={password}
        placeholder="Password"
        minlength="6"
        required
        autocomplete={mode === 'register' ? 'new-password' : 'current-password'}
      />

      {#if error}
        <p class="error">{error}</p>
      {/if}

      <button type="submit" class="btn btn-primary" disabled={loading}>
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

<style>
  .auth-screen {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 28px;
    padding: 20px;
  }
  .title {
    font-size: 2.2rem;
    letter-spacing: 2px;
    color: var(--accent);
  }
  .title span { color: var(--text); font-weight: 300; }
  .auth-box {
    background: var(--surface);
    border-radius: 12px;
    padding: 28px 24px;
    width: 100%;
    max-width: 340px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .auth-box h2 {
    text-align: center;
    font-size: 1.2rem;
    color: var(--text);
  }
  form {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  input {
    padding: 12px 16px;
    border-radius: 8px;
    border: 2px solid var(--surface2);
    background: var(--bg);
    color: var(--text);
    font-size: 0.95rem;
    outline: none;
    width: 100%;
  }
  input:focus { border-color: var(--accent); }
  .error {
    color: var(--accent);
    font-size: 0.85rem;
    text-align: center;
  }
  .toggle {
    text-align: center;
    font-size: 0.85rem;
    color: var(--text-dim);
  }
  .link {
    background: none;
    border: none;
    color: var(--accent);
    cursor: pointer;
    font-size: 0.85rem;
    text-decoration: underline;
  }
</style>
