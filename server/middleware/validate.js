// Validates req.body or req.query against a zod schema.
// Body is replaced with the parsed value (unknown keys stripped), which is what
// blocks mass assignment. Express 5 makes req.query read-only, so parsed query
// params live on req.validQuery instead.
const validate = (schema, source = 'body') => (req, res, next) => {
  const result = schema.safeParse(req[source] ?? {});
  if (!result.success) {
    return res.status(400).json({
      message: 'Validation failed',
      errors: result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    });
  }
  if (source === 'query') req.validQuery = result.data;
  else req[source] = result.data;
  next();
};

module.exports = validate;
