# Licita360 — integração modular do painel administrativo

Este kit foi organizado para a estrutura enviada: Vite + React, Express 5, Prisma 7, PostgreSQL e autenticação por cookie `licita360_session`.

## O que está incluído

- Painel administrativo dividido em páginas e componentes React.
- Tabelas reutilizáveis, cartões de indicadores e resumo visual de assinaturas.
- Serviço de administração separado das rotas HTTP.
- Middleware que exige papel `ADMIN`.
- Rotas para visão geral, usuários, empresas, planos, assinaturas, automações, notificações, auditoria e estado do sistema.
- Este manual com as alterações pontuais necessárias em `auth.js`, `server/index.js` e `DashboardApp.jsx`.

> O painel administra planos e vínculos de assinatura, mas não realiza cobrança. Gateway de pagamento, webhooks, emissão de faturas e aplicação de limites de plano continuam sendo uma etapa separada.

---

## 1. Copie os arquivos

Copie o conteúdo das pastas deste kit para as mesmas pastas do projeto:

```text
src/features/admin/       -> src/features/admin/
server/admin/              -> server/admin/
```

**Não substitua seu `AdminApp.css` atual pelo CSS do dashboard.** Mantenha o CSS que você já enviou em `src/features/admin/AdminApp.css`. Os componentes deste kit reutilizam as classes `l360-admin-*` existentes.

Para o pequeno gráfico de assinaturas, acrescente ao final do `AdminApp.css`:

```css
.l360-admin-chart-list { display: grid; gap: 13px; }
.l360-admin-chart-row { display: grid; gap: 6px; }
.l360-admin-chart-label { display: flex; justify-content: space-between; gap: 12px; color: var(--admin-muted); font-size: 11px; }
.l360-admin-chart-label strong { color: var(--admin-ink); }
.l360-admin-chart-track { height: 9px; overflow: hidden; border-radius: 999px; background: #edf1f7; }
.l360-admin-chart-fill { height: 100%; border-radius: inherit; background: var(--admin-primary); }
```

---

## 2. Integre o menu e a página no DashboardApp.jsx

No início de `src/features/dashboard/DashboardApp.jsx`, junto dos imports, adicione:

```jsx
import AdminApp from '../admin/AdminApp.jsx';
```

Dentro de `showPage(id)`, acrescente uma verificação antes de `setPage(id)` para impedir navegação administrativa por usuário comum:

```jsx
function showPage(id) {
  if (id === 'admin' && currentUser?.role !== 'ADMIN') return;
  setPage(id);
  setSidebarOpen(false);
  setQuery('');
  setStatusFilter('Todos');
}
```

No seu arquivo atual, substitua a função `showPage` existente por essa versão.

Dentro de `<div className="sidebar-bottom">`, antes do cartão `.support-card`, adicione:

```jsx
{currentUser?.role === 'ADMIN' && (
  <button
    className={`nav-link ${page === 'admin' ? 'active' : ''}`}
    onClick={() => showPage('admin')}
    type="button"
  >
    <ShieldCheck size={18} />
    <span>Painel administrativo</span>
  </button>
)}
```

`ShieldCheck` já está na lista de imports do arquivo enviado.

No breadcrumb do `topbar`, troque apenas a expressão que encontra o nome da página por:

```jsx
{page === 'admin'
  ? 'Painel administrativo'
  : (nav.find((item) => item.id === page)?.label || 'Visão geral')}
```

Dentro de `<div className="page-content">`, antes das condições das páginas existentes, adicione:

```jsx
{page === 'admin' && currentUser?.role === 'ADMIN' && (
  <AdminApp
    currentUser={currentUser}
    onBack={() => showPage('overview')}
    onLogout={onLogout}
  />
)}
```

Não inclua `admin` no array `nav` de `utils/licita360.js`: esse array continua exclusivo da navegação normal dos clientes.

---

## 3. Integre as rotas no server/index.js

Acrescente aos imports do início de `server/index.js`:

```js
import { requireAdmin } from './admin/admin.middleware.js';
import { registerAdminRoutes } from './admin/admin.routes.js';
```

Logo depois destas linhas que já existem:

```js
app.use('/api/data', requireAuth);
app.use('/api/partners', requireAuth);
app.use('/api/automation', requireAuth);
```

adicione:

```js
app.use('/api/admin', requireAuth, requireAdmin);
```

Depois da chamada `registerAutomation(...)`, adicione:

```js
registerAdminRoutes({ app, prisma });
```

A ordem é importante: `requireAuth` precisa executar antes de `requireAdmin`, pois o segundo consulta `req.user`.

---

## 4. Atualize server/auth.js

As alterações abaixo são pontuais. Preserve as demais rotas, recuperação de senha, cookies e funções atuais.

### 4.1. Adicione a função de allowlist

Logo após `normalizeEmail`, adicione:

```js
function isConfiguredAdmin(email) {
  const allowlist = String(process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  return allowlist.includes(normalizeEmail(email));
}
```

### 4.2. Substitua publicUser

```js
function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone || '',
    role: isConfiguredAdmin(user.email) ? 'ADMIN' : user.role,
    status: user.status || 'ACTIVE',
    lastLoginAt: user.lastLoginAt || null,
    companyId: user.companyId,
    company: user.company
      ? {
          id: user.company.id,
          name: user.company.name,
          uf: user.company.uf,
          status: user.company.status || 'ACTIVE',
        }
      : undefined,
  };
}
```

O cadastro público continua persistindo `role: 'OWNER'`. A allowlist altera o papel retornado à sessão para a conta cujo e-mail foi autorizado.

### 4.3. Proteja o endereço administrativo reservado no cadastro

Dentro de `POST /api/auth/register`, depois de validar o e-mail e antes de criar o usuário, mantenha a verificação de usuário existente. Se o e-mail ainda não existir e estiver em `ADMIN_EMAILS`, recuse o cadastro público e crie essa conta administradora por um procedimento controlado. Exemplo, logo depois da consulta `existing`:

```js
if (isConfiguredAdmin(email)) {
  return res.status(403).json({
    error: 'Este e-mail está reservado para uma conta administrativa. Entre em contato com o responsável pelo Licita360.',
  });
}
```

Atenção: coloque esse bloqueio **depois** da verificação `if (existing)`, para não impedir o login normal de uma conta administradora que já foi cadastrada anteriormente. Na prática, o fluxo recomendado é configurar `ADMIN_EMAILS` para uma conta já existente, como você descreveu.

### 4.4. Substitua o trecho de sucesso do login

Dentro de `POST /api/auth/login`, depois da validação de senha, use:

```js
const configuredAdmin = isConfiguredAdmin(user.email) || user.role === 'ADMIN';

if (user.status && user.status !== 'ACTIVE') {
  return res.status(403).json({ error: 'Esta conta está suspensa. Entre em contato com o suporte.' });
}

if (user.company?.status === 'SUSPENDED' && !configuredAdmin) {
  return res.status(403).json({ error: 'O acesso desta empresa está suspenso. Entre em contato com o suporte.' });
}

const loggedUser = await prisma.user.update({
  where: { id: user.id },
  data: { lastLoginAt: new Date() },
  include: { company: true },
});

await createSession(res, prisma, loggedUser, req.body?.rememberMe === true);

return res.json({
  ok: true,
  user: publicUser(loggedUser),
});
```

### 4.5. Valide status no endpoint /api/auth/me

Depois de obter `session` e confirmar que ela existe, antes de responder, adicione:

```js
const authenticatedUser = publicUser(session.user);

if (authenticatedUser.status !== 'ACTIVE') {
  await prisma.authSession.deleteMany({ where: { userId: session.userId } });
  clearSessionCookie(res);
  return res.status(403).json({ error: 'Esta conta está suspensa.' });
}

if (
  authenticatedUser.company?.status === 'SUSPENDED' &&
  authenticatedUser.role !== 'ADMIN'
) {
  clearSessionCookie(res);
  return res.status(403).json({ error: 'O acesso desta empresa está suspenso.' });
}
```

E no `res.json`, use `user: authenticatedUser` em vez de recalcular `publicUser(session.user)`.

### 4.6. Substitua o middleware requireAuth retornado no final de registerAuthRoutes

```js
return async function requireAuth(req, res, next) {
  try {
    const session = await readSession(req, prisma);

    if (!session) {
      clearSessionCookie(res);
      return res.status(401).json({ error: 'Faça login para continuar.' });
    }

    const authenticatedUser = publicUser(session.user);

    if (authenticatedUser.status !== 'ACTIVE') {
      await prisma.authSession.deleteMany({ where: { userId: session.userId } });
      clearSessionCookie(res);
      return res.status(403).json({ error: 'Esta conta está suspensa.' });
    }

    if (
      authenticatedUser.company?.status === 'SUSPENDED' &&
      authenticatedUser.role !== 'ADMIN'
    ) {
      clearSessionCookie(res);
      return res.status(403).json({ error: 'O acesso desta empresa está suspenso.' });
    }

    req.user = authenticatedUser;
    req.authSessionId = session.id;

    return authContext.run(req.user, () => next());
  } catch (error) {
    console.error('Erro no middleware de autenticação:', error);
    return res.status(500).json({ error: 'Não foi possível validar sua sessão.' });
  }
};
```

---

## 5. Configure o administrador no Render

No serviço da API, em **Environment**, configure:

```text
Key: ADMIN_EMAILS
Value: email-da-conta-ja-cadastrada-no-Licita360
```

Para dois ou mais administradores, separe os e-mails por vírgula. Use os endereços reais das contas e não compartilhe essa variável publicamente.

Depois de salvar a variável, faça deploy e saia/entre novamente na conta administradora. Isso atualiza o papel retornado pela autenticação.

---

## 6. Banco de dados e testes

O schema enviado já contém `Company.status`, `User.status`, `User.lastLoginAt`, `Plan`, `Subscription` e `AdminAuditLog`. Não é necessário acrescentar esses modelos novamente se esse schema já está aplicado no banco.

Faça backup do PostgreSQL antes de qualquer alteração. Em ambiente local, valide o schema conforme o processo que seu projeto já utiliza:

```bash
npx prisma db push
npx prisma generate
```

Depois, valide os arquivos de servidor e o build:

```bash
node --check server/admin/admin.routes.js
node --check server/admin/admin.service.js
node --check server/admin/admin.middleware.js
npm run build
```

Teste com duas contas diferentes:

1. Conta configurada em `ADMIN_EMAILS`: o menu administrativo deve aparecer e `/api/admin/overview` deve responder com HTTP 200.
2. Conta comum: o menu administrativo não deve aparecer e uma chamada direta a `/api/admin/overview` deve responder com HTTP 403.
3. Suspenda um usuário comum e confirme que uma sessão antiga deixa de acessar `/api/data`.
4. Suspenda uma empresa e confirme que os usuários comuns vinculados a ela recebem bloqueio, enquanto a conta administrativa autorizada continua podendo acessar a central.

## 7. Limites conhecidos desta etapa

- Criar e ativar planos não cobra clientes automaticamente.
- Associar um plano a uma empresa não aplica limites de uso ainda.
- Não há integração de pagamento ou webhook neste kit.
- A tela de sistema exibe apenas indicadores de configuração, nunca o conteúdo de segredos.
- A conta administradora deve ser uma conta previamente controlada e cadastrada. Não configure um endereço que você não controla em `ADMIN_EMAILS`.
