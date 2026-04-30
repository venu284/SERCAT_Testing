import { withAuth } from './with-auth.js';
import { ROLES } from '../constants.js';

export function withAdmin(handler) {
  return withAuth((req, res) => {
    if (req.user.role !== ROLES.ADMIN) {
      return res.status(403).json({ error: 'Admin access required', code: 'FORBIDDEN' });
    }

    return handler(req, res);
  });
}
