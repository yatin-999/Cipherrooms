import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import api from '../api/axios';

interface User {
  _id: string;
  username: string;
  email: string;
  publicKey: string; // JSON string containing edPublicKey and xPublicKey
  avatar?: string;
  bio?: string;
  status: 'online' | 'offline' | 'away';
}

interface AuthContextType {
  user: User | null;
  accessToken: string | null;
  privateKey: string | null;
  login: (token: string, user: User, privateKey: string) => void;
  logout: () => void;
  setPrivateKey: (key: string) => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [privateKey, setPrivateKey] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data } = await api.get('/auth/me');
        setUser(data.user);
      } catch (error) {
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();

    const handleTokenRefreshed = (e: Event) => {
      const customEvent = e as CustomEvent;
      setAccessToken(customEvent.detail);
      api.defaults.headers.common['Authorization'] = 'Bearer ' + customEvent.detail;
    };

    const handleAuthFailed = () => {
      setAccessToken(null);
      setUser(null);
      setPrivateKey(null);
      api.defaults.headers.common['Authorization'] = '';
    };

    window.addEventListener('token_refreshed', handleTokenRefreshed);
    window.addEventListener('auth_failed', handleAuthFailed);

    return () => {
      window.removeEventListener('token_refreshed', handleTokenRefreshed);
      window.removeEventListener('auth_failed', handleAuthFailed);
    };
  }, []);

  const login = (token: string, userData: User, privKey: string) => {
    setAccessToken(token);
    setUser(userData);
    setPrivateKey(privKey);
    api.defaults.headers.common['Authorization'] = 'Bearer ' + token;
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (err) {
      console.error('Logout failed', err);
    }
    setAccessToken(null);
    setUser(null);
    setPrivateKey(null);
    api.defaults.headers.common['Authorization'] = '';
  };

  return (
    <AuthContext.Provider value={{ user, accessToken, privateKey, login, logout, setPrivateKey, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
