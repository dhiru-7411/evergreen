import { createContext, useContext, useEffect, useState } from 'react';
import api from '../api/axios';

const AuthContext = createContext();

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);

const saveSession = ({ token, user }) => {
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(user));
};

const clearSession = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const storedUser = localStorage.getItem('user');
    return storedUser ? JSON.parse(storedUser) : null;
  });

  // A stored token may have expired or belong to a deleted account: confirm it.
  useEffect(() => {
    if (!localStorage.getItem('token')) return;
    api.get('/auth/me').catch((err) => {
      if (err.response?.status === 401) {
        clearSession();
        setUser(null);
      }
    });
  }, []);

  const login = async (email, password) => {
    const response = await api.post('/auth/login', { email, password });
    saveSession(response.data);
    setUser(response.data.user);
  };

  const register = async (username, email, password) => {
    const response = await api.post('/auth/register', { username, email, password });
    saveSession(response.data);
    setUser(response.data.user);
  };

  const logout = () => {
    clearSession();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
