/**
 * Deve ser montado depois do requireAuth, que preenche req.user.
 * O papel ADMIN é calculado pelo auth.js a partir da variável ADMIN_EMAILS
 * ou do papel administrativo persistido no usuário.
 */
export function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      ok: false,
      error: 'Faça login para continuar.',
    });
  }

  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({
      ok: false,
      error: 'Acesso restrito aos administradores do Licita360.',
    });
  }

  return next();
}
