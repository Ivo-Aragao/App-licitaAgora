# Licita360 — Kit da área administrativa

Este kit acrescenta uma central administrativa separada da experiência do cliente. Ele foi preparado para a estrutura que você enviou: Express, Prisma, PostgreSQL, cookie de sessão `licita360_session`, `registerAuthRoutes()` e `DashboardApp.jsx`.

## O que está incluído

- Indicadores globais de usuários, empresas, processos, oportunidades, e-mails e assinaturas.
- Lista de usuários com busca, último acesso e suspensão/reativação.
- Lista de empresas com indicadores e suspensão/reativação.
- Cadastro e ativação/desativação de planos.
- Associação administrativa de planos às empresas.
- Monitoramento de automações, histórico de notificações e auditoria.
- Visão segura da configuração do servidor, sem mostrar segredos.
- Proteção das rotas administrativas no backend.

**Limite desta entrega:** planos e assinaturas ficam cadastrados e administráveis, mas não há cobrança automática, integração com gateway, webhooks ou bloqueio de limites de uso por plano. Esses itens precisam de uma etapa própria antes de vender assinaturas automaticamente.

---

## 1. Atualize o Prisma

O kit inclui `prisma/schema.prisma`, uma cópia completa do schema que você enviou com os campos e modelos administrativos já acrescentados. Faça backup do seu arquivo atual e substitua `prisma/schema.prisma` por esse arquivo. Se preferir mesclar manualmente, siga os trechos abaixo.

### Dentro de `model Company`, acrescente

```prisma
status       String        @default("ACTIVE")
subscription Subscription?
```

### Dentro de `model User`, acrescente

```prisma
status         String           @default("ACTIVE")
lastLoginAt    DateTime?
adminAuditLogs AdminAuditLog[]  @relation("AdminAuditActor")
```

### Acrescente ao final do arquivo

Copie os três modelos inteiros que estão em `prisma/schema.admin-additions.prisma`:

- `Plan`
- `Subscription`
- `AdminAuditLog`

Não apague nenhum modelo que já existe.

Depois, na pasta do projeto, execute:

```bash
npx prisma db push
npx prisma generate
```

Faça backup do PostgreSQL antes de alterar o schema de produção. O deploy atual já executa `prisma db push`, mas faça primeiro a validação local.

---

## 2. Adicione os arquivos do backend

Copie a pasta `server/admin` deste kit para `server/admin` no seu projeto. Ela contém:

- `admin.middleware.js`
- `admin.routes.js`

### Integração em `server/index.js`

Adicione os imports junto dos imports existentes:

```js
import { requireAdmin } from './admin/admin.middleware.js';
import { registerAdminRoutes } from './admin/admin.routes.js';
```

Logo depois das proteções já existentes:

```js
app.use('/api/data', requireAuth);
app.use('/api/partners', requireAuth);
app.use('/api/automation', requireAuth);
```

adicione:

```js
app.use('/api/admin', requireAuth, requireAdmin);
```

Depois da chamada existente de `registerAutomation(...)`, adicione:

```js
registerAdminRoutes({ app, prisma });
```

Não coloque `requireAdmin` antes de `requireAuth`: o middleware administrativo depende de `req.user` já preenchido pela sessão.

---

## 3. Atualize `server/auth.js`

O cadastro público atual já cria usuários com `role: 'OWNER'`, o que deve continuar assim. Não permita que o frontend envie ou escolha `ADMIN`.

### 3.1. Adicione esta função antes de `publicUser()`

```js
function isConfiguredAdmin(email) {
  const allowlist = String(process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  return allowlist.includes(String(email || '').trim().toLowerCase());
}
```

### 3.2. Atualize o objeto de `publicUser(user)`

No objeto retornado, use estes campos (mantenha a estrutura atual de `company`):

```js
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
```

### 3.3. No login, confira o status e registre o último acesso

Dentro de `POST /api/auth/login`, substitua a parte que começa na validação de senha e termina na resposta de sucesso por:

```js
if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
  return res.status(401).json({ error: 'E-mail ou senha inválidos.' });
}

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

### 3.4. No middleware `requireAuth`, valide status a cada requisição

Dentro do `return async function requireAuth(req, res, next)`, depois de verificar que `session` existe, e antes de atribuir `req.user`, adicione:

```js
const authenticatedUser = publicUser(session.user);

if (authenticatedUser.status !== 'ACTIVE') {
  clearSessionCookie(res);
  return res.status(403).json({ error: 'Esta conta está suspensa.' });
}

if (
  session.user.company?.status === 'SUSPENDED' &&
  authenticatedUser.role !== 'ADMIN'
) {
  return res.status(403).json({ error: 'O acesso desta empresa está suspenso.' });
}
```

E troque a atribuição atual:

```js
req.user = publicUser(session.user);
```

por:

```js
req.user = authenticatedUser;
```

Assim, suspender um usuário invalida o acesso dele mesmo que já tenha uma sessão aberta. A suspensão da empresa bloqueia seus usuários comuns.

---

## 4. Integre a tela no `DashboardApp.jsx`

Copie `src/features/admin/AdminApp.jsx` e `src/features/admin/AdminApp.css` deste kit para `src/features/admin/` no seu projeto.

No topo de `features/dashboard/DashboardApp.jsx`, adicione:

```js
import AdminApp from '../admin/AdminApp.jsx';
```

No menu lateral, dentro de `.sidebar-bottom`, antes do cartão de suporte, adicione:

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

`ShieldCheck` já está importado no arquivo que você enviou.

Dentro de `<div className="page-content">`, antes das condições das páginas atuais, adicione:

```jsx
{page === 'admin' && currentUser?.role === 'ADMIN' && (
  <AdminApp
    currentUser={currentUser}
    onBack={() => showPage('overview')}
    onLogout={onLogout}
  />
)}
```

Na linha do breadcrumb, altere o texto que procura o nome da página para reconhecer o ID administrativo:

```jsx
{page === 'admin'
  ? 'Painel administrativo'
  : (nav.find((item) => item.id === page)?.label || 'Visão geral')}
```

Não adicione o item administrativo ao array `nav` compartilhado, porque ele é usado também pelos usuários comuns.

---

## 5. Defina quem é administrador

No Render, abra o serviço da API → **Environment** e crie:

```text
Key: ADMIN_EMAILS
Value: email-da-conta-que-sera-administradora
```

Use o mesmo e-mail de uma conta já cadastrada no Licita360. Para mais de um administrador, separe os e-mails por vírgula.

Exemplo de formato:

```text
ADMIN_EMAILS=admin1@exemplo.com,admin2@exemplo.com
```

Adicione também no `.env` local para testar. Não coloque credenciais ou segredos em arquivos versionados.

Depois de salvar, faça deploy e saia/entre novamente na conta administradora para renovar o objeto de usuário recebido no login. A variável `ADMIN_EMAILS` é a allowlist que concede o papel administrativo; não existe endpoint público para promover usuários.

---

## 6. Validação

1. Faça backup do banco.
2. Atualize o schema e rode `npx prisma db push` e `npx prisma generate`.
3. Adicione os dois arquivos `server/admin`.
4. Atualize `auth.js` e `server/index.js` conforme os trechos acima.
5. Copie os arquivos React e CSS e integre o `DashboardApp.jsx`.
6. Configure `ADMIN_EMAILS` no Render e no `.env` local.
7. Rode `node --check server/admin/admin.routes.js` e `node --check server/admin/admin.middleware.js`.
8. Rode `npm run build`.
9. Entre com o e-mail administrativo: o item “Painel administrativo” deve aparecer.
10. Entre com uma conta comum: o item não deve aparecer e chamadas diretas a `/api/admin/*` devem retornar HTTP 403.

## Observações importantes

- O campo `User.role` continua sendo usado, mas `ADMIN_EMAILS` tem precedência para conceder o papel administrativo.
- O cadastro normal continua criando `OWNER`, nunca `ADMIN`.
- O painel não mostra `passwordHash`, cookies, tokens, URLs secretas nem segredos das integrações.
- Suspensões são aplicadas pelo middleware de autenticação também nas sessões já abertas.
- A tela mostra o estado das integrações sem revelar seus segredos.
- O painel de planos é administrativo; não representa ainda uma cobrança recorrente nem aplica automaticamente cotas de uso.
- Antes de liberar a administração em produção, teste com uma conta comum separada e confirme que ela recebe 403 em `/api/admin/overview`.
