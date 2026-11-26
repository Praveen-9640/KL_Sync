import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, tokenStore, setUnauthorizedHandler } from '../services/api.js';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);
const THEMES = ['classic', 'decent', 'simple', 'normal'];
export const applyTheme = (t) => {
  const theme = THEMES.includes(t) ? t : 'classic';
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('hostelhub_theme', theme);
};
applyTheme(localStorage.getItem('hostelhub_theme'));

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(tokenStore.get()));

  const logout = useCallback(async () => {
    try { if (tokenStore.get()) await api.post('/auth/logout'); } catch { /* ignore */ }
    tokenStore.clear(); setUser(null);
  }, []);
  const login = useCallback((token, u) => { tokenStore.set(token); setUser(u); applyTheme(u.theme); }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => { tokenStore.clear(); setUser(null); });
    if (!tokenStore.get()) return;
    api.get('/auth/me').then(({ user: u }) => { setUser(u); applyTheme(u.theme); })
      .catch(() => tokenStore.clear()).finally(() => setLoading(false));
  }, []);

  return <AuthContext.Provider value={{ user, setUser, loading, login, logout }}>{children}</AuthContext.Provider>;
}
