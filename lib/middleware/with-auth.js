import { verifyToken, getSessionCookie, signToken, setSessionCookie } from '../auth-utils.js';

export function withAuth(handler) {
  return async (req, res) => {
    const token = getSessionCookie(req);
    if (!token) {
      return res.status(401).json({ error: 'Not authenticated', code: 'UNAUTHORIZED' });
    }

    try {
      const payload = verifyToken(token);
      req.user = {
        userId: payload.userId,
        role: payload.role,
        email: payload.email,
        institutionId: payload.institutionId,
      };

      const newToken = signToken({
        userId: payload.userId,
        role: payload.role,
        email: payload.email,
        institutionId: payload.institutionId,
      });
      setSessionCookie(res, newToken);

      return handler(req, res);
    } catch (err) {
      return res.status(401).json({ error: 'Session expired', code: 'UNAUTHORIZED' });
    }
  };
}
