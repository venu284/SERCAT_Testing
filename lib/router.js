function escapeRegex(value) {
  return value.replace(/[|\\{}()[\]^$+*?.-]/g, '\\$&');
}

export function createRouter() {
  const routes = [];

  function addRoute(method, pattern, handler) {
    const paramNames = [];
    const segments = pattern.split('/').filter(Boolean);
    const regexSegments = segments.map((segment) => {
      if (segment.startsWith(':')) {
        paramNames.push(segment.slice(1));
        return '([^/]+)';
      }
      return escapeRegex(segment);
    });

    const regex = new RegExp(`^/${regexSegments.join('/')}$`);
    routes.push({
      method: method.toUpperCase(),
      regex,
      paramNames,
      handler,
    });
  }

  function match(method, path) {
    const normalizedMethod = method.toUpperCase();

    for (const route of routes) {
      if (route.method !== 'ALL' && route.method !== normalizedMethod) {
        continue;
      }

      const matched = path.match(route.regex);
      if (!matched) {
        continue;
      }

      const params = {};
      route.paramNames.forEach((name, index) => {
        params[name] = matched[index + 1];
      });

      return { handler: route.handler, params };
    }

    return null;
  }

  return {
    get: (pattern, handler) => addRoute('GET', pattern, handler),
    post: (pattern, handler) => addRoute('POST', pattern, handler),
    put: (pattern, handler) => addRoute('PUT', pattern, handler),
    delete: (pattern, handler) => addRoute('DELETE', pattern, handler),
    all: (pattern, handler) => addRoute('ALL', pattern, handler),
    match,
  };
}
