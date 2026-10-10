// One-off, idempotent upgrade for posts created before Evergreen's revision
// model existed. Without it, editing an old post would always 409, because the
// optimistic-concurrency filter matches on a `revision` field they don't have.
//
//   npm run migrate
require('dotenv').config();

const mongoose = require('mongoose');
const Post = require('../models/Post');
const Revision = require('../models/Revision');
const { refreshPostFreshness } = require('../services/freshnessService');

async function migrate() {
  const legacy = await Post.collection.find({ revision: { $exists: false } }).toArray();

  for (const doc of legacy) {
    await Post.collection.updateOne(
      { _id: doc._id },
      {
        $set: {
          revision: 1,
          stack: doc.stack ?? [],
          lastRevisedAt: doc.updatedAt ?? doc.createdAt ?? new Date(),
          excerpt: Post.makeExcerpt(doc.content ?? ''),
          freshness: { status: 'untracked', score: null, packages: [] },
        },
      }
    );

    const hasFirst = await Revision.exists({ post: doc._id, number: 1 });
    if (!hasFirst) {
      await Revision.create({
        post: doc._id,
        number: 1,
        title: doc.title,
        content: doc.content,
        stack: doc.stack ?? [],
        note: 'First published',
        editor: doc.author,
      });
    }

    const post = await Post.findById(doc._id);
    if (post.stack.length) await refreshPostFreshness(post);
  }

  return legacy.length;
}

if (require.main === module) {
  (async () => {
    if (!process.env.MONGO_URI) throw new Error('MONGO_URI is not set');
    await mongoose.connect(process.env.MONGO_URI);
    await Promise.all([Post.syncIndexes(), Revision.syncIndexes()]);
    const count = await migrate();
    console.log(count ? `Upgraded ${count} legacy post(s).` : 'Nothing to migrate.');
    await mongoose.disconnect();
  })().catch(async (err) => {
    console.error(err);
    await mongoose.disconnect();
    process.exit(1);
  });
}

module.exports = { migrate };
