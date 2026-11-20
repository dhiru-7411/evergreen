process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');
const registry = require('../services/npmRegistry');
const packageInfo = require('../services/packageInfo');
const app = require('../app');

// Fake npm registry so tests are fast and deterministic.
const LATEST = {
  react: '19.3.0',
  express: '5.2.1',
  mongoose: '9.7.4',
  vite: '8.1.1',
  vue: '3.6.2',
  svelte: '5.40.0',
  request: '2.88.2',
};

const DOWNLOADS = { react: 270_000_000, vue: 26_000_000, svelte: 3_000_000 };
const DEPRECATED = { request: 'request has been deprecated' };
const PUBLISHED = '2026-10-14T16:47:15.290Z';
const ADVISORIES = { request: [{ id: 'GHSA-p8p7-x288-28g6' }] };

// Fake npm for packageInfo: /<name>/latest, the downloads API and deps.dev.
// Set `npmDown.value = true` to simulate the registry being unreachable.
const npmDown = { value: false };
async function fakeNpm(url) {
  if (npmDown.value) throw new Error('getaddrinfo ENOTFOUND registry.npmjs.org');
  const u = new URL(url);
  const notFound = { ok: false, json: async () => ({}) };
  const ok = (body) => ({ ok: true, json: async () => body });
  if (u.pathname.startsWith('/v3/systems/npm/packages/')) {
    const [, name] = u.pathname.match(/^\/v3\/systems\/npm\/packages\/(.+)\/versions\//);
    const pkg = decodeURIComponent(name);
    if (!LATEST[pkg]) return notFound;
    return ok({ publishedAt: PUBLISHED, advisoryKeys: ADVISORIES[pkg] ?? [] });
  }
  if (u.pathname.startsWith('/downloads/point/last-week/')) {
    const name = decodeURIComponent(u.pathname.slice('/downloads/point/last-week/'.length));
    return name in DOWNLOADS ? ok({ downloads: DOWNLOADS[name], package: name }) : notFound;
  }
  const name = decodeURIComponent(u.pathname.split('/').slice(1, -1).join('/'));
  if (!LATEST[name]) return notFound;
  return ok({
    name,
    version: LATEST[name],
    description: `${name} description`,
    license: 'MIT',
    homepage: `https://${name}.dev`,
    repository: { type: 'git', url: `git+https://github.com/example/${name}.git` },
    ...(DEPRECATED[name] && { deprecated: DEPRECATED[name] }),
  });
}

let mongo;

async function setup() {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  registry.clearCache();
  packageInfo.clearCache();
  packageInfo.setFetch(fakeNpm);
  registry.setFetch(async (url) => {
    const name = decodeURIComponent(url.split('/').slice(-2, -1)[0]);
    const version = LATEST[name];
    return version
      ? { ok: true, json: async () => ({ version }) }
      : { ok: false, json: async () => ({}) };
  });
}

async function teardown() {
  await mongoose.disconnect();
  await mongo?.stop();
}

async function resetDb() {
  await Promise.all(Object.values(mongoose.connection.collections).map((c) => c.deleteMany({})));
}

// Signs up and returns the session cookie as a ready-to-use header set.
const cookieHeader = (res) =>
  (res.headers['set-cookie'] || [])
    .map((c) => c.split(';')[0])
    .filter((c) => !c.endsWith('='))
    .join('; ');

async function signup(username) {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ username, email: `${username}@example.com`, password: 'password123' })
    .expect(201);
  return { id: res.body.user.id, cookies: res.headers['set-cookie'], auth: { Cookie: cookieHeader(res) } };
}

async function makeAdmin(user) {
  await mongoose.model('User').updateOne({ _id: user.id }, { role: 'admin' });
  return user;
}

module.exports = { app, request, setup, teardown, resetDb, signup, makeAdmin, cookieHeader, LATEST, DOWNLOADS, PUBLISHED, npmDown };
