const mongoose = require('mongoose');
const { CATEGORY_IDS } = require('../config/categories');

// Snapshot of one package's live npm data. Kept on the topic so pages still
// render (with a "last checked" time) if npm is unreachable.
const packageSnapshotSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    found: { type: Boolean, default: true },
    version: String,
    description: String,
    publishedAt: Date,
    weeklyDownloads: Number,
    advisoryCount: Number, // known security advisories affecting this version
    deprecated: String,
    license: String,
    homepage: String,
    repository: String,
    npmUrl: String,
    checkedAt: Date,
  },
  { _id: false }
);

const alternativeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, lowercase: true }, // npm package
    note: { type: String, trim: true, default: '' }, // "Pick this if…"
  },
  { _id: false }
);

// Something people come to learn, e.g. "React". Tied to one or more npm
// packages; the first is the primary one whose version the page leads with.
const topicSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    category: { type: String, enum: CATEGORY_IDS, required: true },
    summary: { type: String, trim: true, default: '' },
    packages: {
      type: [{ type: String, trim: true, lowercase: true }],
      validate: (v) => v.length > 0,
    },
    alternatives: { type: [alternativeSchema], default: [] },
    // Extra words that mean a page is about this topic ("Claude", "Expo"…),
    // used when checking community-submitted resources for relevance.
    keywords: { type: [{ type: String, trim: true }], default: [] },
    live: {
      checkedAt: Date,
      packages: { type: [packageSnapshotSchema], default: [] },
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

topicSchema.index({ category: 1, name: 1 });
topicSchema.index({ 'live.checkedAt': 1 });

topicSchema.statics.slugify = (name) =>
  name
    .toLowerCase()
    .replace(/\+/g, ' plus ')
    .replace(/#/g, ' sharp ')
    .replace(/\./g, '') // Next.js -> nextjs
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);

// Every package the page shows live data for: its own plus the alternatives.
topicSchema.methods.allPackageNames = function () {
  return [...new Set([...this.packages, ...this.alternatives.map((a) => a.name)])];
};

module.exports = mongoose.model('Topic', topicSchema);
