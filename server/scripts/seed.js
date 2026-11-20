// Seeds demo accounts and posts with deliberately mixed freshness so the app
// has something to show. Only touches data belonging to the demo accounts, so
// it is safe to re-run against a database with real users in it.
//
//   npm run seed
require('dotenv').config();

const mongoose = require('mongoose');
const User = require('../models/User');
const Post = require('../models/Post');
const Revision = require('../models/Revision');
const FixRequest = require('../models/FixRequest');
const Topic = require('../models/Topic');
const { refreshTopic } = require('../services/topicService');
const { refreshPostFreshness } = require('../services/freshnessService');

const DEMO_PASSWORD = 'evergreen-demo';

// Starter topics. Live data (versions, downloads, deprecation) is fetched from
// npm when seeding and refreshed by the background job afterwards.
const TOPICS = [
  {
    name: 'React',
    docsDomains: ['react.dev'],
    category: 'frontend',
    summary: 'The most widely used library for building user interfaces with components.',
    packages: ['react', 'react-dom'],
    alternatives: [
      { name: 'vue', note: 'Pick this if you want a gentler learning curve and templates closer to plain HTML.' },
      { name: 'svelte', note: 'Pick this if you want less boilerplate and a compiler that ships very little JavaScript.' },
      { name: 'solid-js', note: 'Pick this if you like JSX but want fine-grained reactivity and top-tier performance.' },
      { name: 'preact', note: 'Pick this if you want a React-compatible API in about 4 KB.' },
    ],
  },
  {
    name: 'Express',
    docsDomains: ['expressjs.com'],
    category: 'backend',
    summary: 'Minimal, unopinionated web framework for building APIs and servers in Node.js.',
    packages: ['express'],
    alternatives: [
      { name: 'fastify', note: 'Pick this for higher throughput and built-in schema validation.' },
      { name: 'hono', note: 'Pick this if you also target edge runtimes like Cloudflare Workers, Deno or Bun.' },
      { name: 'koa', note: 'Pick this for a smaller core built around async middleware, from the Express team.' },
      { name: '@nestjs/core', note: 'Pick this for large teams that want structure, dependency injection and TypeScript first.' },
    ],
  },
  {
    name: 'Mongoose',
    docsDomains: ['mongoosejs.com'],
    category: 'databases',
    summary: 'Schemas, validation and models for working with MongoDB from Node.js.',
    packages: ['mongoose'],
    alternatives: [
      { name: 'mongodb', note: 'Pick this for the official driver with no schema layer and full control.' },
      { name: 'prisma', note: 'Pick this for type-safe queries and one tool across MongoDB, Postgres and MySQL.' },
      { name: 'drizzle-orm', note: 'Pick this if you are on a SQL database and want a lightweight, TypeScript-first ORM.' },
    ],
  },
  {
    name: 'Vite',
    docsDomains: ['vite.dev'],
    category: 'tooling',
    summary: 'Fast dev server and build tool for modern front-end projects.',
    packages: ['vite'],
    alternatives: [
      { name: 'webpack', note: 'Pick this when maintaining an existing webpack setup or needing its plugin ecosystem.' },
      { name: '@rsbuild/core', note: 'Pick this for a Rust-powered, webpack-compatible build with very fast builds.' },
      { name: 'parcel', note: 'Pick this for zero-config bundling of small projects.' },
    ],
  },
  {
    name: 'Next.js',
    docsDomains: ['nextjs.org'],
    category: 'fullstack',
    summary: 'Full-stack React framework with routing, server rendering and server components.',
    packages: ['next'],
    alternatives: [
      { name: 'react-router', note: 'Pick this (framework mode, formerly Remix) for web-standard loaders and actions.' },
      { name: 'astro', note: 'Pick this for content-heavy sites that ship little JavaScript by default.' },
      { name: 'nuxt', note: 'Pick this if your team prefers Vue over React.' },
    ],
  },
  {
    name: 'TypeScript',
    docsDomains: ['typescriptlang.org', 'devblogs.microsoft.com'],
    category: 'tooling',
    summary: 'JavaScript with static types: catches bugs before they run and powers editor tooling.',
    packages: ['typescript'],
    alternatives: [
      { name: 'flow-bin', note: 'Pick this only when maintaining an existing Flow codebase.' },
    ],
  },
  {
    name: 'Vitest',
    docsDomains: ['vitest.dev'],
    category: 'testing',
    summary: 'Fast unit test runner built on Vite, with a Jest-compatible API.',
    packages: ['vitest'],
    alternatives: [
      { name: 'jest', note: 'Pick this for older projects or when a library only documents Jest setup.' },
      { name: 'mocha', note: 'Pick this for a minimal runner where you choose your own assertion library.' },
      { name: '@playwright/test', note: 'Pick this for end-to-end tests in real browsers (complements a unit runner).' },
    ],
  },
  {
    name: 'React Native',
    docsDomains: ['reactnative.dev', 'docs.expo.dev'],
    category: 'mobile',
    summary: 'Build native iOS and Android apps with React.',
    packages: ['react-native', 'expo'],
    keywords: ['React Native', 'Expo'],
    alternatives: [
      { name: '@capacitor/core', note: 'Pick this to wrap an existing web app as a mobile app.' },
      { name: '@nativescript/core', note: 'Pick this for direct access to native APIs from JavaScript without React.' },
    ],
  },
  {
    name: 'Building with LLMs',
    docsDomains: ['platform.claude.com', 'docs.claude.com'],
    category: 'ai',
    summary: 'Official SDKs and frameworks for calling large language models from JavaScript.',
    packages: ['@anthropic-ai/sdk'],
    keywords: ['Claude', 'Anthropic', 'LLM', 'large language model'],
    alternatives: [
      { name: 'openai', note: "Pick this for OpenAI's models." },
      { name: 'ai', note: 'Pick this (Vercel AI SDK) for one API across many model providers, with React streaming helpers.' },
      { name: 'langchain', note: 'Pick this for prebuilt chains, retrieval and agent tooling across providers.' },
    ],
  },
];
const MONTH = 30 * 24 * 60 * 60 * 1000;

const POSTS = [
  {
    title: 'Building a REST API with Express 4 and Mongoose 5',
    monthsAgo: 40,
    stack: [
      { name: 'express', version: '4.17' },
      { name: 'mongoose', version: '5.13' },
    ],
    content: `Let's build a small REST API for a todo app.

## Setup

\`\`\`bash
npm install express@4 mongoose@5 body-parser
\`\`\`

\`\`\`js
const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });

const app = express();
app.use(bodyParser.json());
\`\`\`

## Handling async errors

Express 4 does not catch rejected promises, so wrap every handler:

\`\`\`js
const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);
\`\`\`
`,
  },
  {
    title: 'Data fetching with useEffect in React 18',
    monthsAgo: 20,
    stack: [{ name: 'react', version: '18.2' }],
    content: `Most React apps fetch data inside \`useEffect\`.

\`\`\`jsx
function Posts() {
  const [posts, setPosts] = useState([]);
  useEffect(() => {
    let ignore = false;
    fetch('/api/posts').then((r) => r.json()).then((data) => {
      if (!ignore) setPosts(data);
    });
    return () => { ignore = true; };
  }, []);
  return posts.map((p) => <Post key={p.id} {...p} />);
}
\`\`\`

The \`ignore\` flag guards against race conditions when the component unmounts.
`,
  },
  {
    title: 'Scaffolding a React 19 app with Vite 8',
    monthsAgo: 2,
    stack: [
      { name: 'vite', version: '8' },
      { name: 'react', version: '19' },
    ],
    content: `Vite is the fastest way to start a React project today.

\`\`\`bash
npm create vite@latest my-app -- --template react
cd my-app && npm install && npm run dev
\`\`\`

React 19 ships Actions, \`use()\` and the React Compiler, so you can delete a lot of \`useMemo\`.
`,
  },
  {
    title: 'Why I write tutorials that expire',
    monthsAgo: 1,
    stack: [],
    content: `Every tutorial is a snapshot of an ecosystem at one moment. The honest thing to do is say so.

This blog tracks the packages each post depends on and tells you when a post has drifted out of date. If you spot something wrong, propose a fix: you'll be credited as a contributor when it's merged.
`,
  },
];

async function upsertUser(username) {
  const email = `${username}@evergreen.dev`;
  let user = await User.findOne({ email });
  if (!user) user = await User.create({ username, email, password: DEMO_PASSWORD });
  return user;
}

async function main() {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is not set');
  await mongoose.connect(process.env.MONGO_URI);

  const author = await upsertUser('demo');
  const reader = await upsertUser('reader');
  // The demo author can manage topics.
  await User.updateOne({ _id: author._id }, { role: 'admin' });

  for (const t of TOPICS) {
    const slug = Topic.slugify(t.name);
    const topic = await Topic.findOneAndUpdate(
      { slug },
      { ...t, slug, createdBy: author._id },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    await refreshTopic(topic);
    const p = topic.live.packages.find((x) => x.name === t.packages[0]);
    console.log(`  topic     ${t.name.padEnd(18)} ${p?.found ? `${p.name}@${p.version}` : 'npm unreachable'}`);
  }

  const oldPosts = await Post.find({ author: author._id }).select('_id');
  const ids = oldPosts.map((p) => p._id);
  await Promise.all([
    Post.deleteMany({ _id: { $in: ids } }),
    Revision.deleteMany({ post: { $in: ids } }),
    FixRequest.deleteMany({ post: { $in: ids } }),
  ]);

  const created = [];
  for (const p of POSTS) {
    const at = new Date(Date.now() - p.monthsAgo * MONTH);
    const post = await Post.create({
      title: p.title,
      content: p.content,
      stack: p.stack,
      author: author._id,
      lastRevisedAt: at,
      createdAt: at,
    });
    await Revision.create({
      post: post._id,
      number: 1,
      title: p.title,
      content: p.content,
      stack: p.stack,
      note: 'First published',
      editor: author._id,
    });
    await refreshPostFreshness(post);
    created.push(post);
    console.log(`  ${post.freshness.status.padEnd(9)} ${post.title}`);
  }

  // A reader-proposed upgrade waiting in the demo author's inbox.
  const express4 = created[0];
  await FixRequest.create({
    post: express4._id,
    postAuthor: author._id,
    proposer: reader._id,
    baseRevision: 1,
    title: 'Building a REST API with Express 5 and Mongoose 9',
    stack: [
      { name: 'express', version: '5' },
      { name: 'mongoose', version: '9' },
    ],
    note: 'Upgrade to Express 5 and Mongoose 9; drop body-parser and the async wrapper',
    content: `Let's build a small REST API for a todo app.

## Setup

\`\`\`bash
npm install express@5 mongoose@9
\`\`\`

\`\`\`js
const express = require('express');
const mongoose = require('mongoose');

await mongoose.connect(process.env.MONGO_URI);

const app = express();
app.use(express.json());
\`\`\`

## Handling async errors

Express 5 forwards rejected promises to your error handler automatically, so the old \`wrap()\` helper is no longer needed.
`,
  });

  console.log(`\nSeeded ${TOPICS.length} topics, ${created.length} posts and 1 open fix request.`);
  console.log(`Log in as demo@evergreen.dev / ${DEMO_PASSWORD} (author + admin) or reader@evergreen.dev (reader).`);
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect();
  process.exit(1);
});
