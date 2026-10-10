const Post = require('../models/Post');
const Revision = require('../models/Revision');
const HttpError = require('../utils/httpError');
const { refreshPostFreshness } = require('./freshnessService');

/**
 * Applies a change to a post as a new revision.
 *
 * Optimistic concurrency: the update only matches if the post is still at
 * `baseRevision`. If someone else revised it in the meantime, nothing is
 * written and the caller gets a 409, the same idea as a git merge conflict.
 */
async function commitRevision({ postId, baseRevision, changes, note, editor, fixRequest, force = false }) {
  const set = { ...changes, lastRevisedAt: new Date() };
  if (changes.content !== undefined) set.excerpt = Post.makeExcerpt(changes.content);

  const filter = { _id: postId };
  if (!force) filter.revision = baseRevision;

  const post = await Post.findOneAndUpdate(
    filter,
    { $set: set, $inc: { revision: 1 } },
    { returnDocument: 'after', runValidators: true }
  );

  if (!post) {
    const current = await Post.findById(postId).select('revision').lean();
    if (!current) throw new HttpError(404, 'Post not found');
    throw new HttpError(
      409,
      `This post has moved on to revision ${current.revision} since revision ${baseRevision}. Review the latest version first.`,
      { currentRevision: current.revision }
    );
  }

  await Revision.create({
    post: post._id,
    number: post.revision,
    title: post.title,
    content: post.content,
    stack: post.stack,
    note,
    editor,
    fixRequest,
  });

  await refreshPostFreshness(post);
  return post;
}

module.exports = { commitRevision };
