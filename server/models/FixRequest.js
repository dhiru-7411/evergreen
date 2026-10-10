const mongoose = require('mongoose');

// A reader-proposed change to a post: a pull request for prose.
const fixRequestSchema = new mongoose.Schema(
  {
    post: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', required: true },
    // Denormalised so an author's inbox is a single indexed query.
    postAuthor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    proposer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // The revision the proposer edited. If the post has moved on, merging conflicts.
    baseRevision: { type: Number, required: true },
    title: { type: String, required: true, trim: true },
    content: { type: String, required: true },
    stack: {
      type: [{ _id: false, name: String, version: String }],
      default: [],
    },
    note: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ['open', 'merged', 'rejected'],
      default: 'open',
    },
    reviewNote: String,
    reviewedAt: Date,
    mergedRevision: Number,
  },
  { timestamps: true }
);

fixRequestSchema.index({ post: 1, status: 1, createdAt: -1 });
fixRequestSchema.index({ postAuthor: 1, status: 1, createdAt: -1 });
fixRequestSchema.index({ proposer: 1, createdAt: -1 });

module.exports = mongoose.model('FixRequest', fixRequestSchema);
