import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api, { setSessionExpiredHandler } from '../utils/api';

const AuthContext = createContext();

const readStoredUser = () => {
  try {
    const raw = localStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(readStoredUser);
  const [loading, setLoading] = useState(Boolean(localStorage.getItem('token')));

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  }, []);

  // A 401 from anywhere means the stored token is no longer usable.
  useEffect(() => {
    setSessionExpiredHandler(() => {
      setUser((prev) => {
        if (prev) {
          // Surface the reason once; the router guard handles the redirect.
          window.dispatchEvent(new CustomEvent('taskflow:session-expired'));
        }
        return null;
      });
    });
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    api
      .get('/auth/me')
      .then(({ data }) => {
        if (cancelled) return;
        setUser(data);
        localStorage.setItem('user', JSON.stringify(data));
      })
      .catch(() => {
        if (!cancelled) logout();
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [logout]);

  const persist = (data) => {
    const next = { _id: data._id, name: data.name, email: data.email };
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(next));
    setUser(next);
    return next;
  };

  const login = async (email, password) => persist((await api.post('/auth/login', { email, password })).data);
  const register = async (name, email, password) =>
    persist((await api.post('/auth/register', { name, email, password })).data);

  const updateUser = (patch) => {
    setUser((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      localStorage.setItem('user', JSON.stringify(next));
      return next;
    });
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);