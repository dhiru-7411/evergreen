const mongoose = require('mongoose');
const { slugify, OBJECT_ID } = require('../utils/slugify');

// A package the post's instructions depend on, e.g. { name: 'react', version: '18' }.
const stackItemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, lowercase: true },
    version: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const packageReportSchema = new mongoose.Schema(
  {
    name: String,
    declared: String,
    latest: String,
    behind: Number, // breaking releases behind (majors, or minors for 0.x)
    status: { type: String, enum: ['fresh', 'aging', 'stale', 'unknown'] },
  },
  { _id: false }
);

const postSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    content: {
      type: String,
      required: true,
    },
    excerpt: String,
    // Readable URL segment, set once from the first title and never changed,
    // so shared links keep working when the title is edited.
    slug: { type: String, unique: true, sparse: true },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    stack: { type: [stackItemSchema], default: [] },
    // Current revision number; bumped atomically on every edit or merged fix.
    revision: { type: Number, default: 1 },
    // When the words last changed. Separate from updatedAt, which also moves
    // whenever the freshness job writes a new report.
    lastRevisedAt: { type: Date, default: Date.now },
    freshness: {
      status: {
        type: String,
        enum: ['fresh', 'aging', 'stale', 'untracked'],
        default: 'untracked',
      },
      score: { type: Number, default: null },
      checkedAt: Date,
      packages: { type: [packageReportSchema], default: [] },
    },
  },
  { timestamps: true }
);

postSchema.index({ createdAt: -1 });
postSchema.index({ 'freshness.status': 1, createdAt: -1 });
postSchema.index({ author: 1, createdAt: -1 });

postSchema.statics.makeExcerpt = (markdown, length = 220) => {
  const text = markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/^#{1,6}\s.*$/gm, ' ')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_~]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > length ? `${text.slice(0, length).trimEnd()}…` : text;
};

// Picks a free slug for a title: "my-post", then "my-post-2", "my-post-3"...
postSchema.statics.uniqueSlug = async function (title, excludeId = null) {
  let base = slugify(title, 80) || 'post';
  if (OBJECT_ID.test(base)) base = `${base}-post`; // never mistakable for an id
  for (let n = 1; ; n++) {
    const candidate = n === 1 ? base : `${base}-${n}`;
    const taken = await this.exists({ slug: candidate, ...(excludeId && { _id: { $ne: excludeId } }) });
    if (!taken) return candidate;
  }
};

postSchema.pre('validate', async function () {
  if (this.isNew && !this.slug) this.slug = await this.constructor.uniqueSlug(this.title);
});

postSchema.pre('validate', function () {
  if (this.isModified('content')) this.excerpt = this.constructor.makeExcerpt(this.content);
});

module.exports = mongoose.model('Post', postSchema);
