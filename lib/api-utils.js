export function success(data, status = 200) {
  return new Response(JSON.stringify({ data }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function error(message, code = 'BAD_REQUEST', status = 400) {
  return new Response(JSON.stringify({ error: message, code }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function unauthorized(message = 'Not authenticated') {
  return error(message, 'UNAUTHORIZED', 401);
}

export function forbidden(message = 'Not authorized') {
  return error(message, 'FORBIDDEN', 403);
}

export function notFound(message = 'Not found') {
  return error(message, 'NOT_FOUND', 404);
}

export function serverError(message = 'Internal server error') {
  return error(message, 'INTERNAL_ERROR', 500);
}
