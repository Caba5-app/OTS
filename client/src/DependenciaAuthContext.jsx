import { createContext, useContext, useEffect, useState } from 'react';
import { api } from './api';

const DependenciaAuthContext = createContext(null);

export function DependenciaAuthProvider({ children }) {
  const [loggedIn, setLoggedIn] = useState(false);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .dependenciaSession()
      .then((s) => {
        setLoggedIn(s.loggedIn);
        setName(s.name || '');
      })
      .catch(() => setLoggedIn(false))
      .finally(() => setLoading(false));
  }, []);

  async function login(password) {
    await api.dependenciaLogin(password);
    const s = await api.dependenciaSession();
    setLoggedIn(s.loggedIn);
    setName(s.name || '');
  }

  async function logout() {
    await api.dependenciaLogout();
    setLoggedIn(false);
    setName('');
  }

  return (
    <DependenciaAuthContext.Provider value={{ loggedIn, name, loading, login, logout }}>
      {children}
    </DependenciaAuthContext.Provider>
  );
}

export function useDependenciaAuth() {
  return useContext(DependenciaAuthContext);
}
