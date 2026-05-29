const API_URL = '/api';

export async function login(username: string, password: string) {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Erro ao fazer login');
  }
  return res.json();
}

export function getToken(): string | null {
  return localStorage.getItem('radar_fx_token');
}

export function setToken(token: string) {
  localStorage.setItem('radar_fx_token', token);
}

export function clearAuth() {
  localStorage.removeItem('radar_fx_token');
  localStorage.removeItem('radar_fx_user');
}

export function isAuthenticated(): boolean {
  return !!getToken();
}

export function getUser(): string | null {
  return localStorage.getItem('radar_fx_user');
}

export async function register(username: string, password: string) {
  const res = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Erro ao registrar');
  }
  return res.json();
}

export async function recoverPassword(username: string) {
  const res = await fetch(`${API_URL}/auth/recover`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Erro ao recuperar senha');
  }
  return res.json();
}

export function getRememberedUser(): string {
  return localStorage.getItem('radar_fx_remembered') || '';
}

export function setRememberedUser(username: string) {
  localStorage.setItem('radar_fx_remembered', username);
}

export function clearRememberedUser() {
  localStorage.removeItem('radar_fx_remembered');
}
