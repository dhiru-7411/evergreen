const mongoose = require('mongoose');

// Immutable snapshot of a post at a given revision number: the post's git log.
const revisionSchema = new mongoose.Schema(
  {
    post: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', required: true },
    number: { type: Number, required: true },
    title: { type: String, required: true },
    content: { type: String, required: true },
    stack: {
      type: [{ _id: false, name: String, version: String }],
      default: [],
    },
    note: { type: String, required: true },
    // Who wrote this revision: the author, or a contributor whose fix was merged.
    editor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    fixRequest: { type: mongoose.Schema.Types.ObjectId, ref: 'FixRequest' },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

revisionSchema.index({ post: 1, number: -1 }, { unique: true });

module.exports = mongoose.model('Revision', revisionSchema);
