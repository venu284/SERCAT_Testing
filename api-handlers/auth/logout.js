import { clearSessionCookie } from '../../lib/auth-utils.js';
import { withMethod } from '../../lib/middleware/with-method.js';

async function handler(req, res) {
  clearSessionCookie(res);
  return res.status(200).json({ data: { message: 'Logged out' } });
}

export default withMethod('POST', handler);
