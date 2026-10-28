import React, { useEffect, useMemo, useRef, useState } from 'react';

import { Radar } from 'lucide-react';

import AuthPage from './features/auth/AuthPage.jsx';

import DashboardApp from './features/dashboard/DashboardApp.jsx';

export default function App() {
  const [authLoading, setAuthLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [initialAuthMode, setInitialAuthMode] = useState('login');
  const [initialResetToken, setInitialResetToken] = useState('');

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams(window.location.search);
    const resetToken = params.get('reset') || params.get('token') || '';

    if (resetToken) {
      setInitialAuthMode('reset');
      setInitialResetToken(resetToken);
    }

    async function checkSession() {
      try {
        const response = await fetch('/api/auth/me', {
          credentials: 'include',
        });
        const payload = await response.json().catch(() => ({}));

        if (!cancelled && !resetToken && response.ok && payload.user) {
          setCurrentUser(payload.user);
        }
      } catch (error) {
        console.warn('Não foi possível verificar a sessão:', error);
      } finally {
        if (!cancelled) setAuthLoading(false);
      }
    }

    checkSession();
    return () => { cancelled = true; };
  }, []);

  async function handleLogout() {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } catch (error) {
      console.warn('Falha ao encerrar sessão no servidor:', error);
    } finally {
      setCurrentUser(null);
      setInitialAuthMode('login');
      setInitialResetToken('');
    }
  }

  if (authLoading) {
    return (
      <div className="auth-loading-screen">
        <div className="auth-loading-brand"><Radar size={23} /> licita<span>360</span></div>
        <div className="auth-loading-spinner" />
        <p>Verificando sua sessão...</p>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <AuthPage
        initialMode={initialAuthMode}
        initialResetToken={initialResetToken}
        onAuthenticated={(user) => {
          setCurrentUser(user);
          setInitialAuthMode('login');
          setInitialResetToken('');
          window.history.replaceState({}, document.title, window.location.pathname);
        }}
      />
    );
  }

  return <DashboardApp currentUser={currentUser} onLogout={handleLogout} />;
}
