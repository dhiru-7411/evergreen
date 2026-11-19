const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/verifyToken');
const requireAdmin = require('../middleware/requireAdmin');
const validate = require('../middleware/validate');
const schemas = require('../validators/schemas');
const { listTopics, getTopic, createTopic, deleteTopic } = require('../controllers/topicController');

router.get('/', listTopics);
router.post('/', verifyToken, requireAdmin, validate(schemas.createTopic), createTopic);
router.get('/:slug', validate(schemas.topicSlug, 'params'), getTopic);
router.delete('/:slug', verifyToken, requireAdmin, validate(schemas.topicSlug, 'params'), deleteTopic);

module.exports = router;
