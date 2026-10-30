import { createAdminService } from './admin.service.js';

function sendFailure(res, error, fallbackMessage) {
  if (error?.code === 'P2002') {
    return res.status(409).json({ ok: false, error: 'Já existe um registro com esse código ou identificador.' });
  }
  if (error?.code === 'P2025') {
    return res.status(404).json({ ok: false, error: 'Registro não encontrado.' });
  }
  if (error?.status) {
    return res.status(error.status).json({ ok: false, error: error.message });
  }
  console.error('[ADMIN]', error);
  return res.status(500).json({ ok: false, error: fallbackMessage });
}

function endpoint(handler, fallbackMessage) {
  return async (req, res) => {
    try {
      const result = await handler(req);
      return res.json(result);
    } catch (error) {
      return sendFailure(res, error, fallbackMessage);
    }
  };
}

export function registerAdminRoutes({ app, prisma }) {
  const service = createAdminService(prisma);

  app.get('/api/admin/overview', endpoint(
    () => service.getOverview(),
    'Não foi possível carregar os indicadores administrativos.',
  ));

  app.get('/api/admin/users', endpoint(
    (req) => service.listUsers(req.query.search),
    'Não foi possível listar os usuários.',
  ));
  app.patch('/api/admin/users/:id/status', endpoint(
    (req) => service.updateUserStatus(req, req.params.id, req.body?.status),
    'Não foi possível atualizar o usuário.',
  ));

  app.get('/api/admin/companies', endpoint(
    (req) => service.listCompanies(req.query.search),
    'Não foi possível listar as empresas.',
  ));
  app.patch('/api/admin/companies/:id/status', endpoint(
    (req) => service.updateCompanyStatus(req, req.params.id, req.body?.status),
    'Não foi possível atualizar a empresa.',
  ));

  app.get('/api/admin/plans', endpoint(
    () => service.listPlans(),
    'Não foi possível carregar os planos.',
  ));
  app.post('/api/admin/plans', async (req, res) => {
    try {
      const result = await service.createPlan(req, req.body || {});
      return res.status(201).json(result);
    } catch (error) {
      return sendFailure(res, error, 'Não foi possível criar o plano.');
    }
  });
  app.put('/api/admin/plans/:id', endpoint(
    (req) => service.updatePlan(req, req.params.id, req.body || {}),
    'Não foi possível atualizar o plano.',
  ));

  app.get('/api/admin/subscriptions', endpoint(
    () => service.listSubscriptions(),
    'Não foi possível listar as assinaturas.',
  ));
  app.put('/api/admin/subscriptions/:companyId', endpoint(
    (req) => service.saveSubscription(req, req.params.companyId, req.body || {}),
    'Não foi possível salvar a assinatura.',
  ));

  app.get('/api/admin/automation', endpoint(
    () => service.getAutomation(),
    'Não foi possível carregar o monitoramento das automações.',
  ));
  app.get('/api/admin/notifications', endpoint(
    () => service.listNotifications(),
    'Não foi possível carregar as notificações.',
  ));
  app.get('/api/admin/audit', endpoint(
    () => service.listAudit(),
    'Não foi possível carregar a auditoria.',
  ));
  app.get('/api/admin/system', endpoint(
    () => service.getSystem(),
    'Não foi possível verificar o estado do sistema.',
  ));
}
