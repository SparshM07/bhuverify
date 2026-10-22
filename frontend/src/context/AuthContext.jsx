import React, { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const savedUser = localStorage.getItem('bhuverify_user');
      const savedToken = localStorage.getItem('bhuverify_token');
      if (savedUser && savedToken) {
        return JSON.parse(savedUser);
      }
    } catch {
      localStorage.removeItem('bhuverify_user');
      localStorage.removeItem('bhuverify_token');
    }
    return null;
  });

  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const handleAuthExpired = () => {
      setUser(null);
    };

    window.addEventListener('auth:expired', handleAuthExpired);
    return () => {
      window.removeEventListener('auth:expired', handleAuthExpired);
    };
  }, []);

  const login = async (email, password) => {
    setIsLoading(true);
    try {
      const data = await authAPI.login(email, password);
      const userData = {
        email: email,
        role: data.role,
        token: data.access_token,
        userId: data.user_id,
      };

      localStorage.setItem('bhuverify_token', data.access_token);
      localStorage.setItem('bhuverify_user', JSON.stringify(userData));
      setUser(userData);
      return { success: true, user: userData };
    } catch (error) {
      const detail = error.response?.data?.detail || 'Authentication failed. Please check your credentials.';
      return { success: false, error: detail };
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('bhuverify_token');
    localStorage.removeItem('bhuverify_user');
    setUser(null);
  };

  const hasRole = (allowedRoles) => {
    if (!user || !user.role) return false;
    if (!allowedRoles || allowedRoles.length === 0) return true;
    return allowedRoles.includes(user.role);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        role: user?.role || 'guest',
        login,
        logout,
        hasRole,
        isLoading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
