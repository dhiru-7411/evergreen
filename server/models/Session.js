const mongoose = require('mongoose');

// One signed-in device. The refresh token is stored only as a hash and is
// replaced on every refresh (rotation). The previous hash is kept briefly so a
// replayed old token can be detected as theft.
const sessionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tokenHash: { type: String, required: true },
    previousHash: { type: String, default: null },
    rotatedAt: { type: Date, default: null },
    expiresAt: { type: Date, required: true },
    lastUsedAt: { type: Date, default: Date.now },
    userAgent: { type: String, default: '' },
    ip: { type: String, default: '' },
    revokedAt: { type: Date, default: null },
    revokedReason: { type: String, default: null },
  },
  { timestamps: true }
);

// MongoDB removes sessions a day after they expire.
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 24 * 60 * 60 });

module.exports = mongoose.model('Session', sessionSchema);
