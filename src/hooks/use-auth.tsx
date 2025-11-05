"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

interface User {
  user: string;
  email: string;
  domain: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password?: string) => Promise<{success: boolean, error?: string}>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true); // Start as true

  useEffect(() => {
    // This effect runs only on the client side
    const checkSession = async () => {
        if (typeof window !== "undefined") {
            try {
                const response = await fetch('/api/check-session');
                if (response.ok) {
                    const data = await response.json();
                    if (data.ok) {
                        setUser(data);
                    } else {
                        setUser(null);
                    }
                } else {
                     setUser(null);
                }
            } catch (error) {
                console.error("Failed to check session", error);
                setUser(null);
            } finally {
                setIsLoading(false);
            }
        }
    };
    
    checkSession();
  }, []);

  const login = async (email: string, password?: string): Promise<{success: boolean, error?: string}> => {
    setIsLoading(true);
    if (!password) {
        setIsLoading(false);
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
        setUser(data);
        return { success: true };
      }
      return { success: false, error: data.error };
    } catch (error) {
      console.error("Login failed", error);
      return { success: false, error: "An unknown error occurred during login." };
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    setIsLoading(true);
    try {
      await fetch('/api/logout', { method: 'POST' });
    } catch (error) {
      console.error("Logout failed", error);
    } finally {
        setUser(null);
        setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
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
