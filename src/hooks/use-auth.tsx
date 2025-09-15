
"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

interface User {
  user: string;
  email: string;
  domain: string;
}

interface AuthContextType {
  user: User | null;
  password?: string;
  isLoading: boolean;
  login: (email: string, password?: string) => Promise<{success: boolean, error?: string}>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// A simple in-memory store for the password.
// This is NOT secure for production in a multi-user server environment,
// but for a single-user desktop-like app, it's a pragmatic way
// to hold the password for backend calls without storing it in cookies or localStorage.
let sessionPassword: string | undefined = undefined;


export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const checkSession = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/check-session');
      const data = await response.json();
      if (data.ok) {
        setUser(data.user);
        // Important: We retrieve the password from session storage on session load.
        const storedPassword = sessionStorage.getItem('atlas-session-pwd');
        if (storedPassword) {
            sessionPassword = storedPassword;
        }
      } else {
        setUser(null);
        sessionPassword = undefined;
        sessionStorage.removeItem('atlas-session-pwd');
      }
    } catch (error) {
      console.error("Failed to check session", error);
      setUser(null);
      sessionPassword = undefined;
      sessionStorage.removeItem('atlas-session-pwd');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  const login = async (email: string, password?: string): Promise<{success: boolean, error?: string}> => {
    if (!password) {
        return { success: false, error: "Password is required." };
    }
    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (data.ok) {
        // Store password in our in-memory variable AND session storage
        sessionPassword = password;
        sessionStorage.setItem('atlas-session-pwd', password);
        setUser(data);
        return { success: true };
      }
      return { success: false, error: data.error };
    } catch (error) {
      console.error("Login failed", error);
      return { success: false, error: "An unknown error occurred during login." };
    }
  };

  const logout = async (): Promise<void> => {
    try {
      await fetch('/api/logout', { method: 'POST' });
    } catch (error) {
      console.error("Logout failed", error);
    } finally {
        setUser(null);
        sessionPassword = undefined;
        sessionStorage.removeItem('atlas-session-pwd');
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, password: sessionPassword }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
