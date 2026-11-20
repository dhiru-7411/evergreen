const mongoose = require('mongoose');

// Single-use tokens sent by email (verify address, reset password). Only the
// SHA-256 hash is stored, so a database leak doesn't leak working links.
const authTokenSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['verify-email', 'reset-password'], required: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

authTokenSchema.index({ user: 1, type: 1 });
authTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 24 * 60 * 60 });

module.exports = mongoose.model('AuthToken', authTokenSchema);
