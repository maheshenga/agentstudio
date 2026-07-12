export const APP_SERVICE_HOST_SOURCE = String.raw`'use strict';

const http = require('node:http');
const path = require('node:path');

const host = '127.0.0.1';
const port = Number(process.env.APP_SERVICE_PORT);
const entry = String(process.env.APP_SERVICE_ENTRY || '');
const healthPath = String(process.env.APP_SERVICE_HEALTH_PATH || '/health');

if (!Number.isInteger(port) || port < 1 || port > 65535 || !entry) {
  throw new Error('invalid_service_host_configuration');
}

const releaseDir = __dirname;
const entryPath = path.resolve(releaseDir, entry);
if (!entryPath.startsWith(releaseDir + path.sep)) {
  throw new Error('invalid_service_entry');
}

const service = require(entryPath);
if (typeof service.health !== 'function' || typeof service.invoke !== 'function') {
  throw new Error('invalid_service_exports');
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    request.on('data', (chunk) => {
      size += chunk.length;
      if (size > 2 * 1024 * 1024) {
        reject(new Error('request_too_large'));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => {
      try {
        resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {});
      } catch {
        reject(new Error('invalid_json'));
      }
    });
    request.on('error', reject);
  });
}

function respond(response, status, value) {
  const body = JSON.stringify(value);
  if (Buffer.byteLength(body) > 2 * 1024 * 1024) {
    response.writeHead(502, { 'content-type': 'application/json' });
    response.end('{"error":"response_too_large"}');
    return;
  }
  response.writeHead(status, { 'content-type': 'application/json' });
  response.end(body);
}

const server = http.createServer(async (request, response) => {
  try {
    if (request.method === 'GET' && request.url === healthPath) {
      respond(response, 200, await service.health({}));
      return;
    }
    if (request.method === 'POST' && request.url === '/invoke') {
      const body = await readJson(request);
      if (body && typeof body === 'object' && body.__agentstudio_runtime === 1) {
        if (body.context && typeof body.context === 'object' && !Array.isArray(body.context)) {
          respond(response, 200, await service.invoke(body.input, body.context));
        } else {
          respond(response, 200, await service.invoke(body.input, {}));
        }
      } else {
        respond(response, 200, await service.invoke(body, {}));
      }
      return;
    }
    respond(response, 404, { error: 'not_found' });
  } catch {
    respond(response, 500, { error: 'service_error' });
  }
});

server.listen(port, host);
`;
