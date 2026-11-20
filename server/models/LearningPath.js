const mongoose = require('mongoose');

const sourceSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    title: { type: String, default: '' },
    // True when the page was actually searched or opened during research on
    // an allowed official-docs domain. Unverified sources are shown to the
    // reviewer as a warning and hidden from the public page.
    verified: { type: Boolean, default: false },
  },
  { _id: false }
);

const stepSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    goal: { type: String, required: true },
    explanation: { type: String, default: '' },
    prerequisites: { type: [Number], default: [] }, // 1-based step numbers
    estimatedHours: { type: Number, default: null },
    versionNote: { type: String, default: '' }, // what changed in recent versions, if relevant
    sources: { type: [sourceSchema], default: [] },
  },
  { _id: false }
);

// An ordered, cited path for learning a topic, drafted by Claude from the
// official docs and published only after an admin approves it.
const learningPathSchema = new mongoose.Schema(
  {
    topic: { type: mongoose.Schema.Types.ObjectId, ref: 'Topic', required: true },
    status: {
      type: String,
      enum: ['generating', 'failed', 'draft', 'published', 'rejected', 'archived'],
      default: 'generating',
    },
    // Version of the topic's main package the path was written against.
    basedOnVersion: String,
    basedOnMajor: Number,
    intro: { type: String, default: '' },
    assumedKnowledge: { type: [String], default: [] },
    steps: { type: [stepSchema], default: [] },
    warnings: { type: [String], default: [] },
    error: String,
    allowedDomains: { type: [String], default: [] },
    researchedUrls: { type: [String], default: [] },
    generation: {
      model: String,
      servedBy: String, // differs from model if a refusal fallback answered
      effort: String,
      inputTokens: Number,
      outputTokens: Number,
      webSearches: Number,
      webFetches: Number,
      durationMs: Number,
    },
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: Date,
    reviewNote: { type: String, default: '' },
  },
  { timestamps: true }
);

learningPathSchema.index({ topic: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model('LearningPath', learningPathSchema);
