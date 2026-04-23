import { withAuth } from './with-auth.js';

export function withAdmin(handler) {
  return withAuth((req, res) => {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required', code: 'FORBIDDEN' });
    }

    return handler(req, res);
  });
}
