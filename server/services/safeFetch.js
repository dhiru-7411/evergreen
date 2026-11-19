// Fetches a user-supplied URL without letting it reach our own network (SSRF).
//
// - http/https only, default ports only, no credentials in the URL
// - every DNS answer is checked inside the socket's lookup, so the address we
//   validate is the address we connect to (no DNS-rebinding window)
// - redirects are followed manually (max 3) and each hop is re-validated
// - bounded time and response size; only text/html or text/plain is read
const http = require('node:http');
const https = require('node:https');
const dns = require('node:dns');
const net = require('node:net');

const MAX_BYTES = 1_000_000;
const TIMEOUT_MS = 8000;
const MAX_REDIRECTS = 3;

class UnsafeUrlError extends Error {}

function isPrivateAddress(address) {
  if (net.isIPv4(address)) {
    const [a, b] = address.split('.').map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) || // carrier-grade NAT
      (a === 169 && b === 254) || // link-local, cloud metadata
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224 // multicast and reserved
    );
  }
  const lower = address.toLowerCase();
  if (lower.startsWith('::ffff:')) return isPrivateAddress(lower.slice(7));
  return (
    lower === '::' ||
    lower === '::1' ||
    lower.startsWith('fc') ||
    lower.startsWith('fd') || // unique local
    lower.startsWith('fe8') ||
    lower.startsWith('fe9') ||
    lower.startsWith('fea') ||
    lower.startsWith('feb') || // link-local
    lower.startsWith('ff') // multicast
  );
}

function safeLookup(hostname, options, callback) {
  dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err);
    const list = Array.isArray(addresses) ? addresses : [{ address: addresses, family: options.family }];
    const bad = list.find((a) => isPrivateAddress(a.address));
    if (bad) return callback(new UnsafeUrlError('That address points to a private network'));
    if (options.all) return callback(null, list);
    return callback(null, list[0].address, list[0].family);
  });
}

function checkUrl(raw) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new UnsafeUrlError('Not a valid URL');
  }
  if (!['http:', 'https:'].includes(url.protocol)) throw new UnsafeUrlError('Only http and https links are allowed');
  if (url.username || url.password) throw new UnsafeUrlError('Links with credentials are not allowed');
  if (url.port && !['80', '443'].includes(url.port)) throw new UnsafeUrlError('Links on unusual ports are not allowed');
  if (net.isIP(url.hostname.replace(/^\[|\]$/g, '')) && isPrivateAddress(url.hostname.replace(/^\[|\]$/g, ''))) {
    throw new UnsafeUrlError('That address points to a private network');
  }
  return url;
}

function requestOnce(url) {
  const lib = url.protocol === 'https:' ? https : http;
  return new Promise((resolve, reject) => {
    const req = lib.get(
      url,
      {
        lookup: safeLookup,
        timeout: TIMEOUT_MS,
        headers: {
          'user-agent': 'EvergreenBot/1.0 (+resource checker)',
          accept: 'text/html,text/plain;q=0.9',
        },
      },
      (res) => {
        const { statusCode, headers } = res;
        if (statusCode >= 300 && statusCode < 400 && headers.location) {
          res.resume();
          return resolve({ status: statusCode, redirect: new URL(headers.location, url).toString() });
        }
        const type = String(headers['content-type'] || '');
        if (statusCode >= 400 || !/text\/(html|plain)/i.test(type)) {
          res.resume();
          return resolve({ status: statusCode, contentType: type, body: '' });
        }
        let size = 0;
        const chunks = [];
        res.on('data', (chunk) => {
          size += chunk.length;
          if (size > MAX_BYTES) {
            res.destroy();
            return;
          }
          chunks.push(chunk);
        });
        res.on('close', () =>
          resolve({ status: statusCode, contentType: type, body: Buffer.concat(chunks).toString('utf8') })
        );
        res.on('error', reject);
      }
    );
    req.on('timeout', () => req.destroy(new Error('Timed out')));
    req.on('error', reject);
  });
}

// Returns { ok, status, finalUrl, contentType, body } or throws UnsafeUrlError.
async function safeFetchPage(raw) {
  let url = checkUrl(raw);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    let res;
    try {
      res = await requestOnce(url);
    } catch (err) {
      if (err instanceof UnsafeUrlError) throw err;
      return { ok: false, status: null, finalUrl: url.toString(), error: err.message, body: '' };
    }
    if (res.redirect) {
      url = checkUrl(res.redirect);
      continue;
    }
    return {
      ok: res.status >= 200 && res.status < 300,
      status: res.status,
      finalUrl: url.toString(),
      contentType: res.contentType,
      body: res.body,
    };
  }
  return { ok: false, status: null, finalUrl: url.toString(), error: 'Too many redirects', body: '' };
}

module.exports = { safeFetchPage, isPrivateAddress, checkUrl, UnsafeUrlError };
