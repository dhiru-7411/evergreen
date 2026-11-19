const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/verifyToken');
const { optionalAuth } = require('../middleware/verifyToken');
const requireAdmin = require('../middleware/requireAdmin');
const validate = require('../middleware/validate');
const { submitLimiter } = require('../middleware/rateLimits');
const schemas = require('../validators/schemas');
const { listTopics, listCategories, getTopic, createTopic, deleteTopic } = require('../controllers/topicController');
const { submitResource } = require('../controllers/resourceController');

const slug = validate(schemas.topicSlug, 'params');

router.get('/', listTopics);
router.get('/categories', listCategories);
router.post('/', verifyToken, requireAdmin, validate(schemas.createTopic), createTopic);
router.get('/:slug', slug, optionalAuth, getTopic);
router.delete('/:slug', verifyToken, requireAdmin, slug, deleteTopic);
router.post('/:slug/resources', verifyToken, submitLimiter, slug, validate(schemas.submitResource), submitResource);

module.exports = router;
