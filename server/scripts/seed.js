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
const { refreshPostFreshness } = require('../services/freshnessService');

const DEMO_PASSWORD = 'evergreen-demo';
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

  console.log(`\nSeeded ${created.length} posts and 1 open fix request.`);
  console.log(`Log in as demo@evergreen.dev / ${DEMO_PASSWORD} (author) or reader@evergreen.dev (reader).`);
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect();
  process.exit(1);
});
