const LOCAL_API_BASE = 'http://localhost/LavaLust-Act6_backend/public/api';
const PRODUCTION_API_BASE = 'https://hidalgo-lava-act6-backend.onrender.com/api';
const configuredApiBase = import.meta.env.VITE_API_BASE_URL?.trim() || '';
const isLocalApiBase = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(?:\/|$)/i.test(configuredApiBase);
const API_BASE = (configuredApiBase && (!import.meta.env.PROD || !isLocalApiBase)
  ? configuredApiBase
  : import.meta.env.DEV ? LOCAL_API_BASE : PRODUCTION_API_BASE).replace(/\/$/, '');
const SESSION_KEY = 'stockroom-session';

export function readSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
  } catch {
    return null;
  }
}

export function saveSession(session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

async function decodeResponse(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || data.message || `Request failed (${response.status})`);
  }
  return data;
}

async function send(path, options = {}, accessToken) {
  const { body: requestData, auth, ...requestOptions } = options;
  const headers = { ...requestOptions.headers };
  let body;

  if (requestData !== undefined) {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    body = new URLSearchParams(
      Object.entries(requestData).map(([key, value]) => [key, String(value ?? '')]),
    );
  }

  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  const response = await fetch(`${API_BASE}${path}`, {
    ...requestOptions,
    headers,
    body,
  });
  return { response, data: await decodeResponse(response) };
}

export async function apiRequest(path, options = {}, session = null, onSession = () => {}) {
  try {
    const result = await send(path, options, options.auth === false ? null : session?.tokens?.access_token);
    return result.data;
  } catch (error) {
    if (error.message !== 'Unauthorized' || !session?.tokens?.refresh_token || options.auth === false) {
      throw error;
    }

    const refreshed = await send('/auth/refresh', {
      method: 'POST',
      body: { refresh_token: session.tokens.refresh_token },
    });
    const nextSession = { ...session, tokens: refreshed.data.tokens };
    saveSession(nextSession);
    onSession(nextSession);
    return (await send(path, options, nextSession.tokens.access_token)).data;
  }
}

export async function signIn(identifier, password) {
  return (await send('/auth/login', {
    method: 'POST',
    body: { identifier, password },
  })).data;
}

export async function registerAccount(username, email, password) {
  return (await send('/auth/register', {
    method: 'POST',
    body: { username, email, password },
  })).data;
}

export async function signOut(session) {
  return apiRequest('/auth/logout', {
    method: 'POST',
    body: { refresh_token: session?.tokens?.refresh_token },
  }, session);
}