const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/verifyToken');
const { optionalAuth } = require('../middleware/verifyToken');
const validate = require('../middleware/validate');
const { authLimiter } = require('../middleware/rateLimits');
const schemas = require('../validators/schemas');
const auth = require('../controllers/authController');

router.post('/register', authLimiter, validate(schemas.register), auth.register);
router.post('/login', authLimiter, validate(schemas.login), auth.login);
router.post('/refresh', authLimiter, auth.refresh);
router.post('/logout', optionalAuth, auth.logout);
router.post('/logout-all', verifyToken, auth.logoutEverywhere);
router.get('/me', verifyToken, auth.me);
router.get('/sessions', verifyToken, auth.listSessions);
router.delete('/sessions/:id', verifyToken, validate(schemas.objectId, 'params'), auth.revokeOne);

module.exports = router;
