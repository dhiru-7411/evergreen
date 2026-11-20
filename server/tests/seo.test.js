const { describe, test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { app, request, setup, teardown, resetDb, signup, makeAdmin } = require('./helpers');

before(setup);
after(teardown);
beforeEach(resetDb);

const CONTENT = 'This is a tutorial body that is long enough to pass validation.';
const meta = (html, prop) => html.match(new RegExp(`<meta (?:property|name)="${prop}" content="([^"]*)"`))?.[1];

describe('link previews', () => {
  test('topic pages describe the topic with live facts', async () => {
    const admin = await makeAdmin(await signup('admin'));
    await request(app)
      .post('/api/topics')
      .set(admin.auth)
      .send({ name: 'React', category: 'frontend', packages: ['react'], summary: 'UI library.', alternatives: [{ name: 'vue' }] })
      .expect(201);
    const res = await request(app).get('/api/og').query({ path: '/learn/react' }).expect(200);
    assert.equal(meta(res.text, 'og:title'), 'Learn React 19 | Evergreen');
    assert.match(meta(res.text, 'og:description'), /UI library\. Latest: v19\.3\.0.*Alternatives: vue\./);
    assert.equal(meta(res.text, 'og:image'), 'http://localhost:5173/og-default.png');
    assert.equal(meta(res.text, 'og:url'), 'http://localhost:5173/learn/react');
    assert.equal(meta(res.text, 'twitter:card'), 'summary_large_image');
  });

  test('post pages use the readable URL, freshness and escape user text', async () => {
    const alice = await signup('alice');
    const post = (
      await request(app)
        .post('/api/posts')
        .set(alice.auth)
        .send({ title: 'Hello <script>alert(1)</script> "quoted"', content: CONTENT, stack: [] })
    ).body;
    const res = await request(app).get('/api/og').query({ path: `/posts/${post._id}` }).expect(200);
    assert.doesNotMatch(res.text, /<script>/);
    assert.match(res.text, /Hello &lt;script&gt;alert\(1\)&lt;\/script&gt; &quot;quoted&quot;/);
    assert.equal(meta(res.text, 'og:type'), 'article');
    assert.equal(meta(res.text, 'og:url'), `http://localhost:5173/posts/${post.slug}`);
    assert.equal(meta(res.text, 'article:author'), 'alice');
  });

  test('unknown pages fall back to the site defaults with a 404', async () => {
    const res = await request(app).get('/api/og').query({ path: '/learn/nope' }).expect(404);
    assert.equal(meta(res.text, 'og:title'), 'Evergreen: learn what&#39;s current');
    await request(app).get('/api/og').query({ path: 'https://evil.example' }).expect(400);
  });
});

describe('search engines', () => {
  test('sitemap lists topics and posts by readable URL', async () => {
    const admin = await makeAdmin(await signup('admin'));
    await request(app).post('/api/topics').set(admin.auth).send({ name: 'React', category: 'frontend', packages: ['react'] });
    await request(app).post('/api/posts').set(admin.auth).send({ title: 'My first post', content: CONTENT, stack: [] });
    const res = await request(app).get('/api/sitemap.xml').expect(200);
    assert.match(res.headers['content-type'], /xml/);
    assert.match(res.text, /<loc>http:\/\/localhost:5173\/learn\/react<\/loc>/);
    assert.match(res.text, /<loc>http:\/\/localhost:5173\/posts\/my-first-post<\/loc>/);
  });

  test('robots.txt points to the sitemap and hides private pages', async () => {
    const res = await request(app).get('/api/robots.txt').expect(200);
    assert.match(res.text, /Sitemap: http:\/\/localhost:5173\/sitemap\.xml/);
    assert.match(res.text, /Disallow: \/account/);
  });
});
