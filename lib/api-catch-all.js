import { apiRoutes } from './api-route-config.js';
import { createRouter } from './router.js';

function normalizeCatchAllPath(query = {}) {
  const pathSegments = Array.isArray(query.path)
    ? query.path
    : [query.path].filter(Boolean);

  return `/${pathSegments.join('/')}`;
}

export function createApiRouter(handlers, routes = apiRoutes) {
  const router = createRouter();

  for (const route of routes) {
    const handler = handlers[route.handlerKey];
    if (typeof handler !== 'function') {
      throw new Error(
        `Missing handler for route "${route.pattern}" (${route.handlerKey} -> ${route.handlerFile})`,
      );
    }

    router.all(route.pattern, handler);
  }

  return router;
}

export function handleCatchAllRequest(router, req, res) {
  const path = normalizeCatchAllPath(req.query);
  const matched = router.match(req.method, path);

  if (!matched) {
    return res.status(404).json({
      error: `API route not found: ${req.method} /api${path}`,
      code: 'NOT_FOUND',
    });
  }

  req.query = { ...(req.query || {}), ...matched.params };
  return matched.handler(req, res);
}
