
import { createHash, randomBytes } from 'node:crypto';
import { AsyncLocalStorage } from 'node:async_hooks';
import bcrypt from 'bcryptjs';

const authContext = new AsyncLocalStorage();

export function getCurrentAuthUser() {
  return authContext.getStore() || null;
}

const COOKIE_NAME = 'licita360_session';
const SESSION_HOURS = 12;
const REMEMBER_SESSION_DAYS = 30;
const RESET_MINUTES = 30;
const MAX_LOGIN_ATTEMPTS = 10;
const RATE_WINDOW_MS = 15 * 60 * 1000;
const attempts = new Map();

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

// ==========================================
// ADMINISTRADORES AUTORIZADOS
// ==========================================

function isConfiguredAdmin(email) {
  const allowlist = String(process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  return allowlist.includes(normalizeEmail(email));
}

function text(value, fallback = '') {
  if (value === null || value === undefined) return fallback;
  return String(value).trim();
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function parseCookies(req) {
  const cookieHeader = req.headers.cookie || '';
  const cookies = {};

  for (const entry of cookieHeader.split(';')) {
    const separator = entry.indexOf('=');
    if (separator < 0) continue;

    const key = entry.slice(0, separator).trim();
    const value = entry.slice(separator + 1).trim();

    try {
      cookies[key] = decodeURIComponent(value);
    } catch {
      cookies[key] = value;
    }
  }

  return cookies;
}

function cookieOptions(maxAgeSeconds) {
  const parts = [
    `${COOKIE_NAME}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${Math.max(0, Math.floor(maxAgeSeconds))}`,
  ];

  if (process.env.NODE_ENV === 'production') parts.push('Secure');

  return parts.join('; ');
}

function setSessionCookie(res, token, maxAgeSeconds) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';

  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.max(0, Math.floor(maxAgeSeconds))}${secure}`
  );
}

function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', cookieOptions(0));
}

// ==========================================
// USUÁRIO PÚBLICO
// ==========================================

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

function checkRateLimit(req, routeName, limit = MAX_LOGIN_ATTEMPTS) {
  const now = Date.now();
  const key = `${routeName}:${req.ip || req.socket?.remoteAddress || 'unknown'}`;
  const prior = attempts.get(key);

  if (!prior || now - prior.startedAt > RATE_WINDOW_MS) {
    attempts.set(key, { startedAt: now, count: 1 });
    return true;
  }

  prior.count += 1;
  return prior.count <= limit;
}

function sendRateLimitError(res) {
  return res.status(429).json({
    error: 'Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.',
  });
}

// ==========================================
// SESSÕES
// ==========================================

async function readSession(req, prisma) {
  const token = parseCookies(req)[COOKIE_NAME];
  if (!token) return null;

  const tokenHash = sha256(token);

  const session = await prisma.authSession.findUnique({
    where: { tokenHash },
    include: {
      user: {
        include: {
          company: true,
        },
      },
    },
  });

  if (!session) return null;

  if (session.expiresAt <= new Date()) {
    await prisma.authSession.deleteMany({ where: { tokenHash } });
    return null;
  }

  return session;
}

async function createSession(res, prisma, user, rememberMe = false) {
  const token = randomBytes(32).toString('base64url');
  const tokenHash = sha256(token);

  const maxAgeSeconds = rememberMe
    ? REMEMBER_SESSION_DAYS * 24 * 60 * 60
    : SESSION_HOURS * 60 * 60;

  const expiresAt = new Date(Date.now() + maxAgeSeconds * 1000);

  await prisma.authSession.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt,
    },
  });

  setSessionCookie(res, token, maxAgeSeconds);
}

// ==========================================
// VALIDAÇÕES
// ==========================================

function validatePassword(password) {
  if (typeof password !== 'string' || password.length < 8) {
    return 'A senha precisa ter pelo menos 8 caracteres.';
  }

  if (password.length > 128) {
    return 'A senha excede o limite de 128 caracteres.';
  }

  return '';
}

function parseBranches(value) {
  const entries = Array.isArray(value)
    ? value
    : String(value || '').split(',');

  return [...new Set(entries.map((item) => text(item)).filter(Boolean))];
}

function validUF(value) {
  const valid = new Set(
    'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ')
  );

  return valid.has(String(value || '').trim().toUpperCase());
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ==========================================
// E-MAIL DE RECUPERAÇÃO
// ==========================================

async function sendResetEmail({ to, name, resetUrl }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.ALERT_FROM_EMAIL;

  if (!apiKey || !from) {
    if (process.env.NODE_ENV !== 'production') {
      console.info(
        `[Licita360 DEV] Link de redefinição para ${to}: ${resetUrl}`
      );

      return { devMode: true };
    }

    throw new Error('O envio de e-mail de recuperação não está configurado.');
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: 'Redefinição de senha — Licita360',
      html: `
        <div style="font-family:Arial,sans-serif;color:#18243a;line-height:1.6;max-width:600px;margin:auto">
          <h2>Redefinir sua senha</h2>
          <p>Olá, ${escapeHtml(name)}.</p>
          <p>Recebemos uma solicitação para redefinir a senha da sua conta Licita360.</p>
          <p>
            <a href="${escapeHtml(resetUrl)}"
               style="display:inline-block;padding:12px 18px;background:#4168df;color:#fff;text-decoration:none;border-radius:8px">
              Criar nova senha
            </a>
          </p>
          <p>Este link expira em ${RESET_MINUTES} minutos e só pode ser usado uma vez.</p>
          <p>Se você não solicitou a redefinição, ignore esta mensagem.</p>
        </div>
      `,
    }),
  });

  const resultText = await response.text();
  let result = {};

  try {
    result = resultText ? JSON.parse(resultText) : {};
  } catch {
    // A resposta do provedor não veio como JSON.
  }

  if (!response.ok) {
    throw new Error(
      result?.message || `Falha no provedor de e-mail (HTTP ${response.status}).`
    );
  }

  return result;
}

// ==========================================
// ROTAS DE AUTENTICAÇÃO
// ==========================================

export function registerAuthRoutes(app, prisma) {

  // ========================================
  // CADASTRO
  // ========================================

  app.post('/api/auth/register', async (req, res) => {
    if (!checkRateLimit(req, 'register', 5)) {
      return sendRateLimitError(res);
    }

    const body = req.body || {};
    const name = text(body.name);
    const companyName = text(body.companyName);
    const email = normalizeEmail(body.email);
    const phone = text(body.phone) || null;
    const cnpjDigits = text(body.cnpj).replace(/\D/g, '');
    const uf = text(body.uf, 'CE').toUpperCase();
    const branches = parseBranches(body.branches);
    const passwordError = validatePassword(body.password);

    if (!name || name.length < 2) {
      return res.status(400).json({
        error: 'Informe seu nome completo.',
      });
    }

    if (!companyName || companyName.length < 2) {
      return res.status(400).json({
        error: 'Informe o nome ou a razão social da empresa.',
      });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({
        error: 'Informe um e-mail válido.',
      });
    }

    if (cnpjDigits && cnpjDigits.length !== 14) {
      return res.status(400).json({
        error: 'O CNPJ deve conter 14 dígitos.',
      });
    }

    if (!validUF(uf)) {
      return res.status(400).json({
        error: 'Selecione uma UF válida.',
      });
    }

    if (passwordError) {
      return res.status(400).json({
        error: passwordError,
      });
    }

    if (body.password !== body.confirmPassword) {
      return res.status(400).json({
        error: 'As senhas não correspondem.',
      });
    }

    if (body.acceptTerms !== true) {
      return res.status(400).json({
        error: 'Confirme a declaração de cadastro para continuar.',
      });
    }

    try {
      const existing = await prisma.user.findUnique({
        where: { email },
      });

      if (existing) {
        return res.status(409).json({
          error: 'Já existe uma conta com esse e-mail. Entre ou use “Esqueci minha senha”.',
        });
      }

      // Impede que um visitante crie uma conta administrativa.
      // A conta ADMIN deve ser criada por procedimento controlado.
      if (isConfiguredAdmin(email)) {
        return res.status(403).json({
          error: 'Este e-mail está reservado para uma conta administrativa. Entre em contato com o responsável pelo Licita360.',
        });
      }

      const passwordHash = await bcrypt.hash(body.password, 12);

      const created = await prisma.$transaction(async (tx) => {

        // Reaproveita a empresa padrão antiga, caso exista
        // e ainda não esteja associada a nenhum usuário.
        const legacyCompany = await tx.company.findUnique({
          where: { id: 'licita360-default-company' },
          include: { users: true, branches: true },
        });

        let company;

        if (legacyCompany && legacyCompany.users.length === 0) {
          company = await tx.company.update({
            where: { id: legacyCompany.id },
            data: {
              name: companyName,
              ...(cnpjDigits ? { cnpj: cnpjDigits } : {}),
              uf,
            },
          });

          if (branches.length) {
            await tx.companyBranch.deleteMany({
              where: { companyId: company.id },
            });

            await tx.companyBranch.createMany({
              data: branches.map((branch) => ({
                name: branch,
                companyId: company.id,
              })),
              skipDuplicates: true,
            });
          }

        } else {
          company = await tx.company.create({
            data: {
              name: companyName,
              cnpj: cnpjDigits || null,
              uf,
              branches: {
                create: branches.map((branch) => ({ name: branch })),
              },
            },
          });
        }

        const user = await tx.user.create({
          data: {
            name,
            email,
            phone,
            passwordHash,
            role: 'OWNER',
            companyId: company.id,
          },
          include: { company: true },
        });

        return user;
      });

      await createSession(res, prisma, created, true);

      return res.status(201).json({
        ok: true,
        user: publicUser(created),
      });

    } catch (error) {
      if (error?.code === 'P2002') {
        return res.status(409).json({
          error: 'Já existe uma conta ou empresa com esse e-mail/CNPJ.',
        });
      }

      console.error('Erro no cadastro de usuário:', error);

      return res.status(500).json({
        error: 'Não foi possível concluir o cadastro. Tente novamente.',
      });
    }
  });

  // ========================================
  // LOGIN
  // ========================================

  app.post('/api/auth/login', async (req, res) => {
    if (!checkRateLimit(req, 'login')) {
      return sendRateLimitError(res);
    }

    const email = normalizeEmail(req.body?.email);

    const password =
      typeof req.body?.password === 'string'
        ? req.body.password
        : '';

    if (!email || !password) {
      return res.status(400).json({
        error: 'Informe o e-mail e a senha.',
      });
    }

    try {
      const user = await prisma.user.findUnique({
        where: { email },
        include: { company: true },
      });

      if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
        return res.status(401).json({
          error: 'E-mail ou senha inválidos.',
        });
      }

      const configuredAdmin =
        isConfiguredAdmin(user.email) || user.role === 'ADMIN';

      if (user.status && user.status !== 'ACTIVE') {
        return res.status(403).json({
          error: 'Esta conta está suspensa. Entre em contato com o suporte.',
        });
      }

      if (
        user.company?.status === 'SUSPENDED' &&
        !configuredAdmin
      ) {
        return res.status(403).json({
          error: 'O acesso desta empresa está suspenso. Entre em contato com o suporte.',
        });
      }

      const loggedUser = await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
        include: { company: true },
      });

      await createSession(
        res,
        prisma,
        loggedUser,
        req.body?.rememberMe === true
      );

      return res.json({
        ok: true,
        user: publicUser(loggedUser),
      });

    } catch (error) {
      console.error('Erro no login:', error);

      return res.status(500).json({
        error: 'Não foi possível entrar agora. Tente novamente.',
      });
    }
  });

  // ========================================
  // VERIFICAR SESSÃO ATUAL
  // ========================================

  app.get('/api/auth/me', async (req, res) => {
    try {
      const session = await readSession(req, prisma);

      if (!session) {
        clearSessionCookie(res);

        return res.status(401).json({
          error: 'Sessão não encontrada ou expirada.',
        });
      }

      const authenticatedUser = publicUser(session.user);

      if (authenticatedUser.status !== 'ACTIVE') {
        await prisma.authSession.deleteMany({
          where: { userId: session.userId },
        });

        clearSessionCookie(res);

        return res.status(403).json({
          error: 'Esta conta está suspensa.',
        });
      }

      if (
        authenticatedUser.company?.status === 'SUSPENDED' &&
        authenticatedUser.role !== 'ADMIN'
      ) {
        clearSessionCookie(res);

        return res.status(403).json({
          error: 'O acesso desta empresa está suspenso.',
        });
      }

      return res.json({
        user: authenticatedUser,
      });

    } catch (error) {
      console.error('Erro ao verificar a sessão:', error);

      return res.status(500).json({
        error: 'Não foi possível verificar sua sessão.',
      });
    }
  });

  // ========================================
  // LOGOUT
  // ========================================

  app.post('/api/auth/logout', async (req, res) => {
    try {
      const token = parseCookies(req)[COOKIE_NAME];

      if (token) {
        await prisma.authSession.deleteMany({
          where: { tokenHash: sha256(token) },
        });
      }

      clearSessionCookie(res);

      return res.json({ ok: true });

    } catch (error) {
      console.error('Erro ao encerrar sessão:', error);

      clearSessionCookie(res);

      return res.status(500).json({
        error: 'Não foi possível encerrar a sessão corretamente.',
      });
    }
  });

  // ========================================
  // SOLICITAR RECUPERAÇÃO DE SENHA
  // ========================================

  app.post('/api/auth/forgot-password', async (req, res) => {
    if (!checkRateLimit(req, 'forgot-password', 5)) {
      return sendRateLimitError(res);
    }

    const email = normalizeEmail(req.body?.email);

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({
        error: 'Informe um e-mail válido.',
      });
    }

    const genericMessage =
      'Se houver uma conta com esse e-mail, enviaremos as instruções de redefinição.';

    try {
      const user = await prisma.user.findUnique({
        where: { email },
      });

      if (!user) {
        return res.json({
          ok: true,
          message: genericMessage,
        });
      }

      const token = randomBytes(32).toString('base64url');
      const tokenHash = sha256(token);

      const expiresAt = new Date(
        Date.now() + RESET_MINUTES * 60 * 1000
      );

      await prisma.passwordResetToken.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: new Date() },
      });

      await prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt,
        },
      });

      const frontendUrl = (
        process.env.FRONTEND_URL || 'http://localhost:5173'
      ).replace(/\/$/, '');

      const resetUrl =
        `${frontendUrl}/?reset=${encodeURIComponent(token)}`;

      let devResetUrl;

      try {
        const result = await sendResetEmail({
          to: user.email,
          name: user.name,
          resetUrl,
        });

        if (
          result.devMode &&
          process.env.NODE_ENV !== 'production'
        ) {
          devResetUrl = resetUrl;
        }

      } catch (error) {
        console.error(
          'Falha no envio de recuperação de senha:',
          error
        );

        if (process.env.NODE_ENV !== 'production') {
          devResetUrl = resetUrl;
        }
      }

      return res.json({
        ok: true,
        message: genericMessage,
        ...(devResetUrl ? { devResetUrl } : {}),
      });

    } catch (error) {
      console.error('Erro na solicitação de redefinição:', error);

      // Não informa ao solicitante se o e-mail está cadastrado.
      return res.json({
        ok: true,
        message: genericMessage,
      });
    }
  });

  // ========================================
  // REDEFINIR SENHA
  // ========================================

  app.post('/api/auth/reset-password', async (req, res) => {
    if (!checkRateLimit(req, 'reset-password', 8)) {
      return sendRateLimitError(res);
    }

    const token = text(req.body?.token);

    const password =
      typeof req.body?.password === 'string'
        ? req.body.password
        : '';

    const confirmPassword =
      typeof req.body?.confirmPassword === 'string'
        ? req.body.confirmPassword
        : '';

    const passwordError = validatePassword(password);

    if (!token) {
      return res.status(400).json({
        error: 'Link de redefinição inválido.',
      });
    }

    if (passwordError) {
      return res.status(400).json({
        error: passwordError,
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        error: 'As senhas não correspondem.',
      });
    }

    try {
      const tokenHash = sha256(token);

      const reset = await prisma.passwordResetToken.findUnique({
        where: { tokenHash },
      });

      if (!reset || reset.usedAt || reset.expiresAt <= new Date()) {
        return res.status(400).json({
          error: 'Este link expirou ou já foi usado. Solicite uma nova recuperação.',
        });
      }

      const passwordHash = await bcrypt.hash(password, 12);

      await prisma.$transaction(async (tx) => {
        const updated = await tx.passwordResetToken.updateMany({
          where: {
            id: reset.id,
            usedAt: null,
            expiresAt: { gt: new Date() },
          },
          data: { usedAt: new Date() },
        });

        if (updated.count !== 1) {
          throw new Error('RESET_TOKEN_ALREADY_USED');
        }

        await tx.user.update({
          where: { id: reset.userId },
          data: { passwordHash },
        });

        await tx.authSession.deleteMany({
          where: { userId: reset.userId },
        });

        await tx.passwordResetToken.updateMany({
          where: {
            userId: reset.userId,
            usedAt: null,
          },
          data: { usedAt: new Date() },
        });
      });

      clearSessionCookie(res);

      return res.json({
        ok: true,
        message: 'Senha redefinida com sucesso. Entre usando a nova senha.',
      });

    } catch (error) {
      if (error?.message === 'RESET_TOKEN_ALREADY_USED') {
        return res.status(400).json({
          error: 'Este link já foi utilizado. Solicite uma nova recuperação.',
        });
      }

      console.error('Erro ao redefinir senha:', error);

      return res.status(500).json({
        error: 'Não foi possível redefinir a senha agora.',
      });
    }
  });

  // ========================================
  // MIDDLEWARE DE AUTENTICAÇÃO
  // ========================================

  return async function requireAuth(req, res, next) {
    try {
      const session = await readSession(req, prisma);

      if (!session) {
        clearSessionCookie(res);

        return res.status(401).json({
          error: 'Faça login para continuar.',
        });
      }

      const authenticatedUser = publicUser(session.user);

      // Bloqueia usuários suspensos.
      if (authenticatedUser.status !== 'ACTIVE') {
        await prisma.authSession.deleteMany({
          where: { userId: session.userId },
        });

        clearSessionCookie(res);

        return res.status(403).json({
          error: 'Esta conta está suspensa.',
        });
      }

      // Bloqueia empresas suspensas, exceto administradores.
      if (
        authenticatedUser.company?.status === 'SUSPENDED' &&
        authenticatedUser.role !== 'ADMIN'
      ) {
        clearSessionCookie(res);

        return res.status(403).json({
          error: 'O acesso desta empresa está suspenso.',
        });
      }

      req.user = authenticatedUser;
      req.authSessionId = session.id;

      return authContext.run(req.user, () => next());

    } catch (error) {
      console.error('Erro no middleware de autenticação:', error);

      return res.status(500).json({
        error: 'Não foi possível validar sua sessão.',
      });
    }
  };
}
