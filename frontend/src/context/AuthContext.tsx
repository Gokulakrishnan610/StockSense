import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { UserProfile } from '../types';
import { api } from '../services/api';

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  loading: boolean;
  login: (loginId: string, password: string) => Promise<void>;
  signup: (payload: { login_id: string; email: string; name: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  isManager: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('stocksense_token'));
  const [loading, setLoading] = useState<boolean>(true);

  const refreshProfile = useCallback(async () => {
    try {
      const profile = await api.getMe();
      setUser(profile);
    } catch {
      localStorage.removeItem('stocksense_token');
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (token) {
      refreshProfile();
    } else {
      setUser(null);
      setLoading(false);
    }
  }, [token, refreshProfile]);

  const login = async (loginId: string, password: string) => {
    const response = await api.login({ login_id: loginId, password });
    localStorage.setItem('stocksense_token', response.access_token);
    setToken(response.access_token);
    const profile = await api.getMe();
    setUser(profile);
  };

  const signup = async (payload: { login_id: string; email: string; name: string; password: string }) => {
    await api.signup(payload);
    await login(payload.login_id, payload.password);
  };

  const logout = async () => {
    try {
      if (token) {
        await api.logout();
      }
    } catch {
      // Ignore network errors on logout
    } finally {
      localStorage.removeItem('stocksense_token');
      setToken(null);
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        signup,
        logout,
        refreshProfile,
        isManager: user?.role === 'INVENTORY_MANAGER',
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
