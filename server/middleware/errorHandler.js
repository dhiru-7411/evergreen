const HttpError = require('../utils/httpError');

const notFound = (req, res) => {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
};

// Express 5 forwards rejected promises from async handlers here automatically.
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  if (err instanceof HttpError) {
    return res
      .status(err.status)
      .json({ message: err.message, ...(err.details && { details: err.details }) });
  }
  if (err.name === 'CastError') {
    return res.status(400).json({ message: `Invalid ${err.path}` });
  }
  if (err.name === 'ValidationError') {
    return res.status(400).json({ message: err.message });
  }
  if (err.code === 11000) {
    return res.status(409).json({ message: 'Duplicate value', fields: Object.keys(err.keyValue || {}) });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'Malformed JSON body' });
  }

  if (process.env.NODE_ENV !== 'test') console.error(err);
  // Never leak internals (stack traces, driver messages) to clients.
  res.status(500).json({ message: 'Something went wrong' });
};

module.exports = { notFound, errorHandler };
