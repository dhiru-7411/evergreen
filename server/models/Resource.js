const mongoose = require('mongoose');

const KINDS = ['tutorial', 'official-docs', 'video', 'course', 'article'];

// A learning resource (link) someone suggested for a topic. Goes through
// automatic checks, then an admin approves or rejects it. Readers can report
// approved resources that turn out wrong or broken.
const resourceSchema = new mongoose.Schema(
  {
    topic: { type: mongoose.Schema.Types.ObjectId, ref: 'Topic', required: true },
    url: { type: String, required: true, trim: true },
    urlKey: { type: String, required: true }, // normalised url, for duplicate detection
    title: { type: String, required: true, trim: true },
    kind: { type: String, enum: KINDS, default: 'tutorial' },
    description: { type: String, trim: true, default: '' },
    submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: Date,
    reviewNote: { type: String, trim: true, default: '' },
    checks: {
      checkedAt: Date,
      reachable: Boolean,
      httpStatus: Number,
      finalUrl: String,
      pageTitle: String,
      relevant: Boolean,
      matchedTerms: [String],
      mentions: Number,
      version: {
        status: { type: String, enum: ['current', 'outdated', 'unknown'], default: 'unknown' },
        latestMajor: Number,
        mentionedMajor: Number,
      },
    },
    reports: {
      type: [
        new mongoose.Schema(
          {
            user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
            reason: { type: String, trim: true, required: true },
            at: { type: Date, default: Date.now },
          },
          { _id: false }
        ),
      ],
      default: [],
    },
  },
  { timestamps: true }
);

resourceSchema.index({ topic: 1, urlKey: 1 }, { unique: true });
resourceSchema.index({ status: 1, createdAt: 1 });

resourceSchema.statics.KINDS = KINDS;

// Normalised form used for duplicate detection.
resourceSchema.statics.normalizeUrl = (raw) => {
  const url = new URL(raw);
  url.hash = '';
  for (const key of [...url.searchParams.keys()]) {
    if (/^utm_|^ref$|^fbclid$|^gclid$/i.test(key)) url.searchParams.delete(key);
  }
  url.hostname = url.hostname.toLowerCase().replace(/^www\./, '');
  let out = url.toString();
  if (out.endsWith('/') && url.pathname !== '/') out = out.slice(0, -1);
  return out;
};

module.exports = mongoose.model('Resource', resourceSchema);
