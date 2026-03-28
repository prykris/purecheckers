import { api } from './api.js';

let currentUser = null;

export async function register(username, email, password) {
  const data = await api.post('/auth/register', { username, email, password });
  localStorage.setItem('checkers_token', data.token);
  currentUser = data.user;
  return data.user;
}

export async function login(email, password) {
  const data = await api.post('/auth/login', { email, password });
  localStorage.setItem('checkers_token', data.token);
  currentUser = data.user;
  return data.user;
}

export async function fetchMe() {
  try {
    const data = await api.get('/auth/me');
    currentUser = data.user;
    return data.user;
  } catch {
    logout();
    return null;
  }
}

export function logout() {
  localStorage.removeItem('checkers_token');
  currentUser = null;
}

export function getUser() {
  return currentUser;
}

export function isLoggedIn() {
  return !!localStorage.getItem('checkers_token');
}
