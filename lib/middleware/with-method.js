export function withMethod(methods, handler) {
  const allowed = Array.isArray(methods) ? methods : [methods];

  return async (req, res) => {
    if (!allowed.includes(req.method)) {
      res.setHeader('Allow', allowed.join(', '));
      return res.status(405).json({
        error: `Method ${req.method} not allowed`,
        code: 'METHOD_NOT_ALLOWED',
      });
    }

    return handler(req, res);
  };
}
