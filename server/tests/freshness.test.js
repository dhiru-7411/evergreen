const { test } = require('node:test');
const assert = require('node:assert/strict');
const { assessPost, assessPackage } = require('../services/freshness');

const NOW = new Date('2026-10-01').getTime();
const recent = new Date('2026-09-01');
const latest = new Map([
  ['react', '19.3.0'],
  ['express', '5.2.1'],
  ['mongoose', '9.7.4'],
  ['zod', '4.6.5'],
  ['tiny', '0.9.0'],
  ['ghost', null],
]);

test('package on the latest major is fresh', () => {
  assert.equal(assessPackage({ name: 'react', version: '^19.0.0' }, '19.3.0').status, 'fresh');
});

test('one major behind is aging, two or more is stale', () => {
  assert.deepEqual(
    [assessPackage({ name: 'react', version: '18' }, '19.3.0'), assessPackage({ name: 'react', version: '16.8' }, '19.3.0')].map(
      (p) => [p.behind, p.status]
    ),
    [
      [1, 'aging'],
      [3, 'stale'],
    ]
  );
});

test('0.x packages treat minor bumps as breaking', () => {
  const p = assessPackage({ name: 'tiny', version: '0.7.2' }, '0.9.0');
  assert.equal(p.behind, 2);
  assert.equal(p.status, 'stale');
});

test('post with no stack is untracked', () => {
  const r = assessPost([], latest, recent, NOW);
  assert.equal(r.status, 'untracked');
  assert.equal(r.score, null);
});

test('unknown packages are reported but do not affect the score', () => {
  const r = assessPost(
    [
      { name: 'ghost', version: '1' },
      { name: 'zod', version: '4' },
    ],
    latest,
    recent,
    NOW
  );
  assert.equal(r.status, 'fresh');
  assert.equal(r.score, 100);
  assert.equal(r.packages[0].status, 'unknown');
});

test('a post is only as fresh as its most outdated dependency', () => {
  const r = assessPost(
    [
      { name: 'react', version: '19' },
      { name: 'express', version: '4.18' },
      { name: 'mongoose', version: '5' },
    ],
    latest,
    recent,
    NOW
  );
  assert.equal(r.status, 'stale');
  assert.equal(r.score, 0);
});

test('old content loses points even when versions are current', () => {
  const twoYearsAgo = new Date('2024-06-01');
  const r = assessPost([{ name: 'react', version: '19' }], latest, twoYearsAgo, NOW);
  assert.equal(r.score, 80);
  assert.equal(r.status, 'fresh');

  const aging = assessPost([{ name: 'react', version: '18' }], latest, twoYearsAgo, NOW);
  assert.equal(aging.score, 40);
  assert.equal(aging.status, 'stale');
});
