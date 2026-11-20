import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import api from '../api/axios';

const AuthContext = createContext();

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  // True until we know whether a session cookie is valid.
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    // Older versions kept the token in localStorage; remove it.
    try {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    } catch {
      // Storage may be unavailable (private mode); nothing to clean up.
    }

    let ignore = false;
    api
      .get('/auth/me')
      .then((res) => !ignore && setUser(res.data.user))
      .catch(() => !ignore && setUser(null))
      .finally(() => !ignore && setChecking(false));

    // The API client fires this when a session can't be refreshed.
    const onExpired = () => setUser(null);
    window.addEventListener('auth:expired', onExpired);
    return () => {
      ignore = true;
      window.removeEventListener('auth:expired', onExpired);
    };
  }, []);

  const login = async (email, password) => {
    const response = await api.post('/auth/login', { email, password });
    setUser(response.data.user);
  };

  const register = async (username, email, password) => {
    const response = await api.post('/auth/register', { username, email, password });
    setUser(response.data.user);
  };

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      setUser(null);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, checking, login, register, logout, setUser }}>
      {children}
    </AuthContext.Provider>
  );
};
