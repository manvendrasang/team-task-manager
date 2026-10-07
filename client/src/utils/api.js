import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: { 'Content-Type': 'application/json' },
});

// Endpoints where a 401 means "those credentials are wrong", not "your session
// ended". Redirecting there would reload the page and wipe the login form.
const NO_SESSION_REDIRECT = ['/auth/login', '/auth/register'];

const isAuthAttempt = (url = '') =>
  NO_SESSION_REDIRECT.some((path) => url.includes(path));

let onSessionExpired = () => {};
export const setSessionExpiredHandler = (fn) => { onSessionExpired = fn; };

// Attach token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Drop an expired session once, without the hard navigation that used to throw
// away app state (and form state) mid-request.
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err.response?.status;
    if (status === 401 && !isAuthAttempt(err.config?.url)) {
      localStorage.removeItem('token');
      onSessionExpired();
    }
    return Promise.reject(err);
  }
);

/** Pulls a human-readable message out of an axios error for the toast layer. */
export const errorMessage = (err, fallback = 'Something went wrong') => {
  const data = err?.response?.data;
  if (Array.isArray(data?.errors) && data.errors[0]?.msg) return data.errors[0].msg;
  if (Array.isArray(data?.details?.errors) && data.details.errors[0]?.msg) {
    return data.details.errors[0].msg;
  }
  if (data?.message) return data.message;
  if (err?.response) return `Request failed (${err.response.status})`;
  if (err?.message === 'Network Error') return 'Cannot reach the server. Is it running?';
  return fallback;
};

export default api;