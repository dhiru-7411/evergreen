process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');
const registry = require('../services/npmRegistry');
const app = require('../app');

// Fake npm registry so tests are fast and deterministic.
const LATEST = {
  react: '19.3.0',
  express: '5.2.1',
  mongoose: '9.7.4',
  vite: '8.1.1',
};

let mongo;

async function setup() {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  registry.clearCache();
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

async function signup(username) {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ username, email: `${username}@example.com`, password: 'password123' })
    .expect(201);
  return { token: res.body.token, id: res.body.user.id, auth: { Authorization: `Bearer ${res.body.token}` } };
}

module.exports = { app, request, setup, teardown, resetDb, signup, LATEST };
