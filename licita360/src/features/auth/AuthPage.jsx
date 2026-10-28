import React, { useEffect, useMemo, useRef, useState } from 'react';

import {
  Activity, AlertCircle, ArrowRight, ArrowUpRight, Bell,
  BriefcaseBusiness, CalendarClock, Check, CheckCheck, CheckCircle2,
  ChevronDown, ChevronRight, CircleHelp, ClipboardCheck, Clock3,
  CloudDownload, FileCheck2, FileSearch, FileText, Filter, FolderOpen,
  LayoutDashboard, ListTodo, BellRing, Building2, Mail, Play, Save, Users, 
  LoaderCircle, Menu, Plus, Radar, Search,
  Settings2, ShieldCheck, Sparkles, Target, Upload, Wallet, X,
  Eye, EyeOff, KeyRound, LockKeyhole, LogOut, UserRound, Phone, ArrowLeft,
} from 'lucide-react';

import * as Utils from '../../utils/licita360.js';
const { STORAGE_KEY, storageKeyForUser, todayISO, uid, fmtBRL, parseDate, formatDate, toDateTimeLocalValue, initialData, loadData, nav, statusOptions, normalizeSearchText, BRANCH_SYNONYMS, getBranchSearchTerms, findMatchingBranches, calculateProjectedProfit, UF_OPTIONS, csvValues, emptyPartnerDraft } = Utils;

export default function AuthPage({ initialMode = 'login', initialResetToken = '', onAuthenticated }) {
  const [mode, setMode] = useState(initialMode);
  const [resetToken, setResetToken] = useState(initialResetToken);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [devResetUrl, setDevResetUrl] = useState('');
  const [form, setForm] = useState({
    name: '',
    companyName: '',
    cnpj: '',
    email: '',
    phone: '',
    uf: 'CE',
    branches: '',
    password: '',
    confirmPassword: '',
    acceptTerms: false,
    rememberMe: false,
  });

  useEffect(() => {
    setMode(initialMode);
    setResetToken(initialResetToken);
  }, [initialMode, initialResetToken]);

  function changeMode(nextMode) {
    setMode(nextMode);
    setError('');
    setNotice('');
    setDevResetUrl('');
    if (nextMode !== 'reset') setResetToken('');
  }

  function update(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function request(path, payload) {
    const response = await fetch(path, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'Não foi possível concluir a operação.');
    return result;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setNotice('');
    setDevResetUrl('');

    if (mode === 'register') {
      if (form.password.length < 8) {
        setError('Sua senha precisa ter pelo menos 8 caracteres.');
        return;
      }
      if (form.password !== form.confirmPassword) {
        setError('As senhas não correspondem.');
        return;
      }
      if (!form.acceptTerms) {
        setError('Para continuar, confirme que leu os termos e o aviso de privacidade.');
        return;
      }
    }

    if (mode === 'reset') {
      if (form.password.length < 8) {
        setError('Sua nova senha precisa ter pelo menos 8 caracteres.');
        return;
      }
      if (form.password !== form.confirmPassword) {
        setError('As senhas não correspondem.');
        return;
      }
    }

    setBusy(true);
    try {
      if (mode === 'login') {
        const result = await request('/api/auth/login', {
          email: form.email.trim().toLowerCase(),
          password: form.password,
          rememberMe: form.rememberMe,
        });
        onAuthenticated(result.user);
      } else if (mode === 'register') {
        const result = await request('/api/auth/register', {
          name: form.name.trim(),
          companyName: form.companyName.trim(),
          cnpj: form.cnpj.trim(),
          email: form.email.trim().toLowerCase(),
          phone: form.phone.trim(),
          uf: form.uf,
          branches: form.branches.split(',').map((item) => item.trim()).filter(Boolean),
          password: form.password,
          confirmPassword: form.confirmPassword,
          acceptTerms: form.acceptTerms,
        });
        onAuthenticated(result.user);
      } else if (mode === 'forgot') {
        const result = await request('/api/auth/forgot-password', {
          email: form.email.trim().toLowerCase(),
        });
        setNotice(result.message || 'Se houver uma conta com esse e-mail, você receberá as instruções para redefinir sua senha.');
        setDevResetUrl(result.devResetUrl || '');
      } else if (mode === 'reset') {
        const result = await request('/api/auth/reset-password', {
          token: resetToken,
          password: form.password,
          confirmPassword: form.confirmPassword,
        });
        setNotice(result.message || 'Senha redefinida. Entre com sua nova senha.');
        setForm((current) => ({ ...current, password: '', confirmPassword: '' }));
        setResetToken('');
        window.history.replaceState({}, document.title, window.location.pathname);
        setMode('login');
      }
    } catch (submitError) {
      setError(submitError.message || 'Ocorreu um erro. Tente novamente.');
    } finally {
      setBusy(false);
    }
  }

  const registration = mode === 'register';
  const forgot = mode === 'forgot';
  const resetting = mode === 'reset';
  const title = registration
    ? 'Crie sua conta'
    : forgot
      ? 'Recuperar senha'
      : resetting
        ? 'Defina uma nova senha'
        : 'Bem-vindo de volta';
  const description = registration
    ? 'Cadastre sua empresa e comece a organizar oportunidades.'
    : forgot
      ? 'Informe seu e-mail para receber as instruções de recuperação.'
      : resetting
        ? 'Escolha uma senha nova e segura para sua conta.'
        : 'Entre para acompanhar licitações, documentos e oportunidades.';

  return (
    <main className="auth-shell">
      <section className="auth-showcase">
        <div className="auth-brand">
          <span className="auth-brand-mark"><Radar size={24} /></span>
          <span>licita<strong>360</strong></span>
        </div>
        <div className="auth-showcase-content">
          <span className="auth-eyebrow">INTELIGÊNCIA EM COMPRAS PÚBLICAS</span>
          <h1>Encontre oportunidades.<br /><em>Prepare-se para vencer.</em></h1>
          <p>Organize processos, acompanhe prazos e encontre oportunidades alinhadas ao perfil da sua empresa em um só lugar.</p>
          <div className="auth-feature-list">
            <div><span><Radar size={18} /></span><div><strong>Radar de licitações</strong><small>Descubra oportunidades compatíveis com seus segmentos.</small></div></div>
            <div><span><BellRing size={18} /></span><div><strong>Alertas e prazos</strong><small>Organize vencimentos e acompanhe novidades.</small></div></div>
            <div><span><ShieldCheck size={18} /></span><div><strong>Gestão da sua empresa</strong><small>Tenha seus processos e tarefas organizados.</small></div></div>
          </div>
        </div>
        <div className="auth-showcase-footer">LICITA360 · GESTÃO E PROSPECÇÃO DE LICITAÇÕES</div>
      </section>

      <section className="auth-form-side">
        <div className="auth-form-wrap">
          <div className="auth-mobile-brand"><span className="auth-brand-mark"><Radar size={22} /></span>licita<strong>360</strong></div>
          <div className="auth-form-heading">
            {mode !== 'login' && (
              <button type="button" className="auth-back-button" onClick={() => changeMode('login')}>
                <ArrowLeft size={16} /> Voltar ao login
              </button>
            )}
            <h2>{title}</h2>
            <p>{description}</p>
          </div>

          {error && <div className="auth-message auth-message-error" role="alert"><AlertCircle size={17} /><span>{error}</span></div>}
          {notice && <div className="auth-message auth-message-success" role="status"><CheckCircle2 size={17} /><span>{notice}</span></div>}
          {devResetUrl && (
            <div className="auth-dev-reset">
              <strong>Link de teste (ambiente local)</strong>
              <a href={devResetUrl}>Abrir redefinição de senha</a>
            </div>
          )}

          <form className="auth-form" onSubmit={handleSubmit}>
            {registration && (
              <>
                <div className="auth-section-label">DADOS DO RESPONSÁVEL</div>
                <label className="auth-field">
                  <span>Nome completo</span>
                  <div className="auth-input-wrap"><UserRound size={17} /><input required autoComplete="name" value={form.name} onChange={(event) => update('name', event.target.value)} placeholder="Seu nome completo" /></div>
                </label>
                <div className="auth-field-grid">
                  <label className="auth-field">
                    <span>E-mail de acesso</span>
                    <div className="auth-input-wrap"><Mail size={17} /><input required type="email" autoComplete="email" value={form.email} onChange={(event) => update('email', event.target.value)} placeholder="voce@empresa.com.br" /></div>
                  </label>
                  <label className="auth-field">
                    <span>Telefone (opcional)</span>
                    <div className="auth-input-wrap"><Phone size={17} /><input autoComplete="tel" value={form.phone} onChange={(event) => update('phone', event.target.value)} placeholder="(88) 99999-9999" /></div>
                  </label>
                </div>
                <div className="auth-section-label">DADOS DA EMPRESA</div>
                <label className="auth-field">
                  <span>Razão social ou nome da empresa</span>
                  <div className="auth-input-wrap"><Building2 size={17} /><input required autoComplete="organization" value={form.companyName} onChange={(event) => update('companyName', event.target.value)} placeholder="Nome da sua empresa" /></div>
                </label>
                <div className="auth-field-grid">
                  <label className="auth-field">
                    <span>CNPJ (opcional)</span>
                    <div className="auth-input-wrap"><Building2 size={17} /><input autoComplete="off" value={form.cnpj} onChange={(event) => update('cnpj', event.target.value)} placeholder="00.000.000/0000-00" /></div>
                  </label>
                  <label className="auth-field">
                    <span>Estado principal</span>
                    <div className="auth-input-wrap auth-select-wrap"><select value={form.uf} onChange={(event) => update('uf', event.target.value)}>{UF_OPTIONS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}</select><ChevronDown size={15} /></div>
                  </label>
                </div>
                <label className="auth-field">
                  <span>Ramos de atuação</span>
                  <input className="auth-plain-input" value={form.branches} onChange={(event) => update('branches', event.target.value)} placeholder="Limpeza, dedetização, informática..." />
                  <small>Separe os ramos por vírgula. Você poderá editá-los depois.</small>
                </label>
              </>
            )}

            {(mode === 'login' || forgot) && (
              <label className="auth-field">
                <span>E-mail</span>
                <div className="auth-input-wrap"><Mail size={17} /><input required type="email" autoComplete="email" value={form.email} onChange={(event) => update('email', event.target.value)} placeholder="voce@empresa.com.br" /></div>
              </label>
            )}

            {(mode === 'login' || registration || resetting) && (
              <>
                {registration && <div className="auth-section-label">SEGURANÇA DA CONTA</div>}
                <label className="auth-field">
                  <span>{resetting ? 'Nova senha' : 'Senha'}</span>
                  <div className="auth-input-wrap"><LockKeyhole size={17} /><input required minLength={8} type={showPassword ? 'text' : 'password'} autoComplete={resetting ? 'new-password' : registration ? 'new-password' : 'current-password'} value={form.password} onChange={(event) => update('password', event.target.value)} placeholder={resetting ? 'Crie uma nova senha (mín. 8 caracteres)' : 'Digite sua senha'} /><button type="button" className="auth-password-toggle" aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'} onClick={() => setShowPassword((value) => !value)}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div>
                </label>
                {(registration || resetting) && (
                  <label className="auth-field">
                    <span>Confirmar senha</span>
                    <div className="auth-input-wrap"><KeyRound size={17} /><input required minLength={8} type={showConfirmPassword ? 'text' : 'password'} autoComplete="new-password" value={form.confirmPassword} onChange={(event) => update('confirmPassword', event.target.value)} placeholder="Digite a senha novamente" /><button type="button" className="auth-password-toggle" aria-label={showConfirmPassword ? 'Ocultar confirmação' : 'Mostrar confirmação'} onClick={() => setShowConfirmPassword((value) => !value)}>{showConfirmPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div>
                  </label>
                )}
              </>
            )}

            {registration && (
              <label className="auth-terms">
                <input type="checkbox" checked={form.acceptTerms} onChange={(event) => update('acceptTerms', event.target.checked)} />
                <span>Confirmo que tenho autorização para cadastrar esta empresa e que as informações fornecidas são verdadeiras. Estou ciente de que meus dados serão usados para administrar minha conta no Licita360.</span>
              </label>
            )}

            {mode === 'login' && (
              <div className="auth-form-options"><label><input type="checkbox" checked={form.rememberMe} onChange={(event) => update('rememberMe', event.target.checked)} /> <span>Manter minha sessão neste dispositivo</span></label><button type="button" onClick={() => changeMode('forgot')}>Esqueci minha senha</button></div>
            )}

            <button className="auth-submit" type="submit" disabled={busy}>
              {busy ? <><span className="auth-button-spinner" /> Processando...</> : resetting ? 'Salvar nova senha' : forgot ? 'Enviar instruções' : registration ? 'Criar minha conta' : 'Entrar na plataforma'}
              {!busy && <ArrowRight size={17} />}
            </button>
          </form>

          <div className="auth-switch">
            {registration ? <>Já tem uma conta? <button type="button" onClick={() => changeMode('login')}>Entrar</button></> : forgot || resetting ? <>Lembrou sua senha? <button type="button" onClick={() => changeMode('login')}>Voltar ao login</button></> : <>Ainda não tem uma conta? <button type="button" onClick={() => changeMode('register')}>Cadastre sua empresa</button></>}
          </div>
          <div className="auth-secure-note"><ShieldCheck size={15} /> Acesso protegido · Licita360</div>
        </div>
      </section>
    </main>
  );
}
