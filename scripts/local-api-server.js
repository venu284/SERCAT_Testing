import http from 'node:http';
import { parse as parseQueryString } from 'node:querystring';
import { config as loadEnv } from 'dotenv';
import catchAllHandler from '../api/[...path].js';

loadEnv({ path: '.env.local', quiet: true });
loadEnv({ quiet: true });

const DEFAULT_PORT = 5174;
const host = process.env.API_HOST || '127.0.0.1';
const port = Number(process.env.API_PORT || DEFAULT_PORT);

function parseBody(req, rawBody) {
  if (!rawBody) return {};

  const contentType = req.headers['content-type'] || '';
  if (contentType.includes('application/json')) {
    return JSON.parse(rawBody);
  }

  if (contentType.includes('application/x-www-form-urlencoded')) {
    return parseQueryString(rawBody);
  }

  return rawBody;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function attachVercelResponseHelpers(res) {
  res.status = (statusCode) => {
    res.statusCode = statusCode;
    return res;
  };

  res.json = (payload) => {
    if (!res.headersSent) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
    }
    res.end(payload == null ? '' : JSON.stringify(payload));
    return res;
  };

  res.send = (payload) => {
    if (typeof payload === 'object' && payload !== null) {
      return res.json(payload);
    }
    res.end(payload ?? '');
    return res;
  };

  return res;
}

function buildQuery(url) {
  const path = url.pathname.replace(/^\/api\/?/, '');
  const query = Object.fromEntries(url.searchParams.entries());
  return {
    ...query,
    path: path ? path.split('/').map(decodeURIComponent) : [],
  };
}

const server = http.createServer(async (req, res) => {
  attachVercelResponseHelpers(res);

  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

    if (!url.pathname.startsWith('/api')) {
      return res.status(404).json({ error: 'Local API server only handles /api routes' });
    }

    req.query = buildQuery(url);
    req.body = parseBody(req, await readBody(req));

    await catchAllHandler(req, res);
  } catch (error) {
    console.error('[LOCAL API ERROR]', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Local API error', detail: error?.message || String(error) });
    } else {
      res.end();
    }
  }
});

server.listen(port, host, () => {
  console.log(`[local-api] listening on http://${host}:${port}`);
});
