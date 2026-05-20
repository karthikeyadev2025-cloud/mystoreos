import { useState } from 'react';

export const useAuth = () => {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('mystore_session');
    return saved ? JSON.parse(saved) : null;
  });

  const login = (userData) => {
    localStorage.setItem('mystore_session', JSON.stringify(userData));
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('mystore_session');
    setUser(null);
  };

  return { user, login, logout };
};
