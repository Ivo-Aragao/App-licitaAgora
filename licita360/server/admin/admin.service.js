const USER_STATUSES = new Set(['ACTIVE', 'SUSPENDED']);
const COMPANY_STATUSES = new Set(['ACTIVE', 'SUSPENDED']);
const SUBSCRIPTION_STATUSES = new Set(['TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'EXPIRED']);
const BILLING_CYCLES = new Set(['MONTHLY', 'YEARLY']);

function httpError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function isConfiguredAdmin(email) {
  const allowlist = String(process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  return allowlist.includes(String(email || '').trim().toLowerCase());
}

const cleanText = (value, max = 180) => String(value ?? '').trim().slice(0, max);

function toNumber(value, fallback = NaN) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function slugify(value) {
  return cleanText(value, 80)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function parseOptionalDate(value, fieldName) {
  if (value === undefined || value === null || value === '') return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw httpError(`A data informada em ${fieldName} é inválida.`, 400);
  }
  return date;
}

function normalizePlan(body, current = null) {
  const name = cleanText(body.name ?? current?.name, 80);
  const code = slugify(body.code ?? current?.code ?? name);
  const description = cleanText(body.description ?? current?.description, 500) || null;
  const price = toNumber(body.price ?? current?.price);
  const billingCycle = cleanText(body.billingCycle ?? current?.billingCycle ?? 'MONTHLY', 20).toUpperCase();
  const trialDays = Math.trunc(toNumber(body.trialDays ?? current?.trialDays, 0));
  const maxUsers = Math.trunc(toNumber(body.maxUsers ?? current?.maxUsers, 1));
  const maxOpportunities = Math.trunc(toNumber(body.maxOpportunities ?? current?.maxOpportunities, 50));
  const featuresInput = body.features ?? current?.features ?? [];
  const features = [...new Set(
    (Array.isArray(featuresInput) ? featuresInput : String(featuresInput).split(','))
      .map((item) => cleanText(item, 100))
      .filter(Boolean),
  )].slice(0, 30);

  if (!name || !code) throw httpError('Informe o nome e o código do plano.', 400);
  if (!Number.isFinite(price) || price < 0) throw httpError('Informe um preço válido.', 400);
  if (!BILLING_CYCLES.has(billingCycle)) throw httpError('Ciclo de cobrança inválido.', 400);
  if (trialDays < 0 || trialDays > 365) throw httpError('O teste deve ficar entre 0 e 365 dias.', 400);
  if (maxUsers < 1 || maxUsers > 100000) throw httpError('Limite de usuários inválido.', 400);
  if (maxOpportunities < 1 || maxOpportunities > 10000000) throw httpError('Limite de oportunidades inválido.', 400);

  return {
    name,
    code,
    description,
    price,
    billingCycle,
    trialDays,
    maxUsers,
    maxOpportunities,
    features,
    ...(body.active !== undefined ? { active: Boolean(body.active) } : {}),
  };
}

function auditData(req, action, entityType, entityId, details = {}) {
  return {
    adminUserId: req.user.id,
    adminEmail: req.user.email,
    action,
    entityType,
    entityId: entityId ? String(entityId) : null,
    details,
    ip: req.ip || req.socket?.remoteAddress || null,
    userAgent: cleanText(req.get?.('user-agent'), 500) || null,
  };
}

export function createAdminService(prisma) {
  return {
    async getOverview() {
      const since = new Date(Date.now() - 30 * 86400000);
      const [
        users,
        activeUsers,
        companies,
        activeCompanies,
        opportunities,
        discoveries,
        sentEmails,
        failedEmails,
        activeSubscriptions,
        newUsers30Days,
        recentUsers,
        recentNotifications,
      ] = await Promise.all([
        prisma.user.count(),
        prisma.user.count({ where: { status: 'ACTIVE' } }),
        prisma.company.count(),
        prisma.company.count({ where: { status: 'ACTIVE' } }),
        prisma.opportunity.count(),
        prisma.discoveredOpportunity.count(),
        prisma.notificationLog.count({ where: { status: 'sent' } }),
        prisma.notificationLog.count({ where: { status: 'failed' } }),
        prisma.subscription.count({ where: { status: 'ACTIVE' } }),
        prisma.user.count({ where: { createdAt: { gte: since } } }),
        prisma.user.findMany({
          take: 6,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true, name: true, email: true, role: true, status: true, createdAt: true,
            company: { select: { id: true, name: true } },
          },
        }),
        prisma.notificationLog.findMany({
          take: 6,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true, type: true, subject: true, status: true, recipientEmail: true, createdAt: true,
            company: { select: { name: true } },
          },
        }),
      ]);

      return {
        ok: true,
        metrics: {
          users, activeUsers, companies, activeCompanies, opportunities, discoveries,
          sentEmails, failedEmails, activeSubscriptions, newUsers30Days,
        },
        recentUsers: recentUsers.map((user) => ({
          ...user,
          role: isConfiguredAdmin(user.email) ? 'ADMIN' : user.role,
        })),
        recentNotifications,
      };
    },

    async listUsers(searchValue) {
      const search = cleanText(searchValue, 100);
      const where = search ? {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { company: { name: { contains: search, mode: 'insensitive' } } },
        ],
      } : {};
      const usersFromDb = await prisma.user.findMany({
        where,
        take: 200,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, name: true, email: true, phone: true, role: true, status: true,
          lastLoginAt: true, createdAt: true,
          company: { select: { id: true, name: true, status: true } },
        },
      });
      return {
        ok: true,
        users: usersFromDb.map((user) => ({
          ...user,
          role: isConfiguredAdmin(user.email) ? 'ADMIN' : user.role,
        })),
      };
    },

    async updateUserStatus(req, userId, statusValue) {
      const status = cleanText(statusValue, 20).toUpperCase();
      if (!USER_STATUSES.has(status)) throw httpError('Status de usuário inválido.', 400);
      if (userId === req.user.id && status !== 'ACTIVE') {
        throw httpError('Você não pode suspender sua própria conta administrativa.', 400);
      }

      return prisma.$transaction(async (tx) => {
        const target = await tx.user.findUnique({
          where: { id: userId },
          select: { id: true, email: true, role: true },
        });
        if (!target) throw httpError('Usuário não encontrado.', 404);
        if (status !== 'ACTIVE' && (target.role === 'ADMIN' || isConfiguredAdmin(target.email))) {
          throw httpError('Não é permitido suspender uma conta administradora por esta tela.', 403);
        }

        const updated = await tx.user.update({
          where: { id: userId },
          data: { status },
          select: { id: true, name: true, email: true, status: true },
        });
        await tx.adminAuditLog.create({
          data: auditData(req, `USER_${status}`, 'User', updated.id, { status }),
        });
        return { ok: true, user: updated };
      });
    },

    async listCompanies(searchValue) {
      const search = cleanText(searchValue, 100);
      const companies = await prisma.company.findMany({
        where: search ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { cnpj: { contains: search } },
          ],
        } : {},
        take: 200,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { users: true, opportunities: true, discoveries: true, notifications: true } },
          subscription: { include: { plan: true } },
        },
      });
      return { ok: true, companies };
    },

    async updateCompanyStatus(req, companyId, statusValue) {
      const status = cleanText(statusValue, 20).toUpperCase();
      if (!COMPANY_STATUSES.has(status)) throw httpError('Status de empresa inválido.', 400);
      return prisma.$transaction(async (tx) => {
        const updated = await tx.company.update({
          where: { id: companyId },
          data: { status },
          select: { id: true, name: true, status: true },
        });
        await tx.adminAuditLog.create({
          data: auditData(req, `COMPANY_${status}`, 'Company', updated.id, { status }),
        });
        return { ok: true, company: updated };
      });
    },

    async listPlans() {
      const plans = await prisma.plan.findMany({
        orderBy: [{ active: 'desc' }, { price: 'asc' }],
        include: { _count: { select: { subscriptions: true } } },
      });
      return { ok: true, plans };
    },

    async createPlan(req, body) {
      const data = normalizePlan(body || {});
      const plan = await prisma.$transaction(async (tx) => {
        const created = await tx.plan.create({ data });
        await tx.adminAuditLog.create({
          data: auditData(req, 'PLAN_CREATED', 'Plan', created.id, { name: created.name, code: created.code }),
        });
        return created;
      });
      return { ok: true, plan };
    },

    async updatePlan(req, planId, body) {
      const current = await prisma.plan.findUnique({ where: { id: planId } });
      if (!current) throw httpError('Plano não encontrado.', 404);
      const data = normalizePlan(body || {}, current);
      const plan = await prisma.$transaction(async (tx) => {
        const updated = await tx.plan.update({ where: { id: current.id }, data });
        await tx.adminAuditLog.create({
          data: auditData(req, 'PLAN_UPDATED', 'Plan', updated.id, { name: updated.name, active: updated.active }),
        });
        return updated;
      });
      return { ok: true, plan };
    },

    async listSubscriptions() {
      const subscriptions = await prisma.subscription.findMany({
        take: 200,
        orderBy: { updatedAt: 'desc' },
        include: {
          company: { select: { id: true, name: true, cnpj: true, status: true } },
          plan: { select: { id: true, name: true, code: true, price: true, billingCycle: true } },
        },
      });
      return { ok: true, subscriptions };
    },

    async saveSubscription(req, companyId, body) {
      const planId = cleanText(body?.planId, 100);
      const status = cleanText(body?.status, 20).toUpperCase();
      if (!planId || !SUBSCRIPTION_STATUSES.has(status)) {
        throw httpError('Informe um plano e um status de assinatura válidos.', 400);
      }
      const currentPeriodEnd = parseOptionalDate(body?.currentPeriodEnd, 'fim do período');
      const trialEndsAt = parseOptionalDate(body?.trialEndsAt, 'fim do teste');
      const [company, plan] = await Promise.all([
        prisma.company.findUnique({ where: { id: companyId } }),
        prisma.plan.findUnique({ where: { id: planId } }),
      ]);
      if (!company) throw httpError('Empresa não encontrada.', 404);
      if (!plan || !plan.active) throw httpError('Selecione um plano ativo.', 400);

      const subscription = await prisma.$transaction(async (tx) => {
        const saved = await tx.subscription.upsert({
          where: { companyId: company.id },
          create: {
            companyId: company.id, planId: plan.id, status,
            currentPeriodStart: new Date(), currentPeriodEnd, trialEndsAt,
            canceledAt: status === 'CANCELED' ? new Date() : null,
          },
          update: {
            planId: plan.id, status, currentPeriodStart: new Date(), currentPeriodEnd,
            trialEndsAt, canceledAt: status === 'CANCELED' ? new Date() : null,
          },
          include: { company: true, plan: true },
        });
        await tx.adminAuditLog.create({
          data: auditData(req, 'SUBSCRIPTION_UPSERTED', 'Subscription', saved.id, {
            companyId: company.id, planId: plan.id, status,
          }),
        });
        return saved;
      });
      return { ok: true, subscription };
    },

    async getAutomation() {
      const [settings, sent, failed, pending, lastNotification] = await Promise.all([
        prisma.prospectingSettings.findMany({
          include: { company: { select: { id: true, name: true, status: true } } },
          orderBy: { updatedAt: 'desc' },
          take: 200,
        }),
        prisma.notificationLog.count({ where: { status: 'sent' } }),
        prisma.notificationLog.count({ where: { status: 'failed' } }),
        prisma.notificationLog.count({ where: { status: 'pending' } }),
        prisma.notificationLog.findFirst({ orderBy: { createdAt: 'desc' }, select: { createdAt: true } }),
      ]);
      return {
        ok: true,
        metrics: {
          configuredCompanies: settings.length,
          enabledProspecting: settings.filter((setting) => setting.enabled).length,
          dailyDigestEnabled: settings.filter((setting) => setting.dailyEmailEnabled).length,
          sent,
          failed,
          pending,
          lastNotificationAt: lastNotification?.createdAt || null,
        },
        settings,
      };
    },

    async listNotifications() {
      const notifications = await prisma.notificationLog.findMany({
        take: 150,
        orderBy: { createdAt: 'desc' },
        include: { company: { select: { id: true, name: true } } },
      });
      return { ok: true, notifications };
    },

    async listAudit() {
      const logs = await prisma.adminAuditLog.findMany({
        take: 150,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, adminEmail: true, action: true, entityType: true,
          entityId: true, details: true, ip: true, createdAt: true,
        },
      });
      return { ok: true, logs };
    },

    async getSystem() {
      await prisma.$queryRaw`SELECT 1`;
      return {
        ok: true,
        system: {
          nodeVersion: process.version,
          environment: process.env.NODE_ENV || 'development',
          timezone: process.env.TZ || 'America/Fortaleza',
          uptimeSeconds: Math.floor(process.uptime()),
          databaseConnected: true,
          gmailScriptConfigured: Boolean(process.env.GMAIL_SCRIPT_URL && process.env.GMAIL_SCRIPT_SECRET),
          adminAllowlistConfigured: Boolean(process.env.ADMIN_EMAILS?.trim()),
          frontendUrlConfigured: Boolean(process.env.FRONTEND_URL),
        },
      };
    },
  };
}

export { httpError };
