const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/verifyToken');
const { optionalAuth } = require('../middleware/verifyToken');
const requireAdmin = require('../middleware/requireAdmin');
const validate = require('../middleware/validate');
const { submitLimiter } = require('../middleware/rateLimits');
const schemas = require('../validators/schemas');
const { list, create, vote, update, mine } = require('../controllers/topicRequestController');

const id = validate(schemas.objectId, 'params');

router.get('/', optionalAuth, validate(schemas.listTopicRequests, 'query'), list);
router.get('/mine', verifyToken, mine);
router.post('/', verifyToken, submitLimiter, validate(schemas.createTopicRequest), create);
router.post('/:id/vote', verifyToken, id, vote);
router.patch('/:id', verifyToken, requireAdmin, id, validate(schemas.updateTopicRequest), update);

module.exports = router;
