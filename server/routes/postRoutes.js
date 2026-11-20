const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/verifyToken');
const requireVerified = require('../middleware/requireVerified');
const validate = require('../middleware/validate');
const { recheckLimiter } = require('../middleware/rateLimits');
const schemas = require('../validators/schemas');
const Post = require('../models/Post');
const { OBJECT_ID } = require('../utils/slugify');
const {
  createPost,
  getAllPosts,
  getStats,
  getPostById,
  updatePost,
  deletePost,
  recheckFreshness,
  listRevisions,
  getRevision,
} = require('../controllers/postController');
const { proposeFix, listFixesForPost } = require('../controllers/fixController');

// Every /:id route accepts the readable slug too.
router.param('id', async (req, res, next, value) => {
  if (OBJECT_ID.test(value)) return next();
  const post = await Post.findOne({ slug: String(value).toLowerCase() }).select('_id');
  if (!post) return res.status(404).json({ message: 'Post not found' });
  req.params.id = String(post._id);
  next();
});

router.get('/', validate(schemas.listPosts, 'query'), getAllPosts);
router.post('/', verifyToken, requireVerified, validate(schemas.createPost), createPost);
router.get('/stats', getStats);

router.get('/:id', getPostById);
router.patch('/:id', verifyToken, validate(schemas.updatePost), updatePost);
router.delete('/:id', verifyToken, deletePost);

router.post('/:id/freshness', verifyToken, recheckLimiter, recheckFreshness);

router.get('/:id/revisions', listRevisions);
router.get('/:id/revisions/:number', getRevision);

router.get('/:id/fixes', validate(schemas.listFixes, 'query'), listFixesForPost);
router.post('/:id/fixes', verifyToken, requireVerified, validate(schemas.proposeFix), proposeFix);

module.exports = router;
