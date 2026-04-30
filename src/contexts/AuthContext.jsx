import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { api } from '../lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const checkedRef = useRef(false);

  useEffect(() => {
    if (checkedRef.current) return;
    checkedRef.current = true;

    api.get('/auth/me')
      .then((res) => {
        setUser(res.data.user);
      })
      .catch(() => {
        setUser(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const login = useCallback(async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    setUser(res.data.user);
    return res.data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch (e) {
      // Ignore logout errors
    }
    setUser(null);
  }, []);

  const activate = useCallback(async (token, password, confirmPassword, phone) => {
    const res = await api.post('/auth/activate', { token, password, confirmPassword, phone });
    return res.data;
  }, []);

  const requestReset = useCallback(async (email) => {
    const res = await api.post('/auth/reset-password', { email });
    return res.data;
  }, []);

  const setNewPassword = useCallback(async (token, password, confirmPassword) => {
    const res = await api.post('/auth/set-password', { token, password, confirmPassword });
    return res.data;
  }, []);

  const refreshUser = useCallback(async () => {
    const res = await api.get('/auth/me');
    setUser(res.data.user);
  }, []);

  const value = React.useMemo(() => ({
    user,
    loading,
    login,
    logout,
    activate,
    requestReset,
    setNewPassword,
    refreshUser,
  }), [user, loading, login, logout, activate, requestReset, setNewPassword, refreshUser]);

  return React.createElement(AuthContext.Provider, { value }, children);
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
