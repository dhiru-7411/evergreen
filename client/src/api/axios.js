import axios from 'axios';

// The API is reached at /api on the same site as the app (Vite's dev proxy
// locally; a Vercel/Netlify rewrite in production), so login cookies are
// first-party. Tokens live in httpOnly cookies the page can't read.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true,
});

const AUTH_PATHS = ['/auth/login', '/auth/register', '/auth/refresh', '/auth/logout'];
let refreshing = null;

// One refresh at a time, shared by every request that hit an expired token.
function refreshSession() {
  refreshing ??= api
    .post('/auth/refresh')
    .catch((err) => {
      // 409: another tab refreshed a moment ago; its cookies are already set.
      if (err.response?.status === 409) return null;
      throw err;
    })
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

api.interceptors.response.use(undefined, async (error) => {
  const { config, response } = error;
  const isAuthCall = AUTH_PATHS.some((p) => config?.url?.startsWith(p));
  if (response?.status !== 401 || !config || config._retried || isAuthCall) throw error;

  try {
    await refreshSession();
  } catch {
    window.dispatchEvent(new Event('auth:expired'));
    throw error;
  }
  return api({ ...config, _retried: true });
});

// Turns any API failure into a single readable sentence.
export const errorMessage = (err, fallback = 'Something went wrong') => {
  const data = err?.response?.data;
  if (data?.errors?.length) return data.errors.map((e) => (e.path ? `${e.path}: ${e.message}` : e.message)).join(' · ');
  return data?.message || (err?.response ? fallback : 'Could not reach the server');
};

export default api;
