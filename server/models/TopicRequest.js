const mongoose = require('mongoose');
const { CATEGORY_IDS } = require('../config/categories');

// A user's request for a topic Evergreen doesn't cover yet. Others upvote it,
// and admins mark it planned, done (with the topic it became) or declined.
const topicRequestSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    // Same normalisation as topic slugs, for duplicate detection.
    nameKey: { type: String, required: true, index: true },
    category: { type: String, enum: CATEGORY_IDS, required: true },
    packageName: { type: String, trim: true, lowercase: true, default: null },
    description: { type: String, trim: true, default: '' },
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    voters: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], default: [] },
    voteCount: { type: Number, default: 0 },
    status: { type: String, enum: ['open', 'planned', 'done', 'declined'], default: 'open' },
    adminNote: { type: String, trim: true, default: '' },
    topic: { type: mongoose.Schema.Types.ObjectId, ref: 'Topic', default: null },
  },
  { timestamps: true }
);

topicRequestSchema.index({ status: 1, voteCount: -1, createdAt: 1 });

module.exports = mongoose.model('TopicRequest', topicRequestSchema);
