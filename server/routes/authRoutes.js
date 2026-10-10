const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/verifyToken');
const validate = require('../middleware/validate');
const { authLimiter } = require('../middleware/rateLimits');
const schemas = require('../validators/schemas');
const { register, login, me } = require('../controllers/authController');

router.post('/register', authLimiter, validate(schemas.register), register);
router.post('/login', authLimiter, validate(schemas.login), login);
router.get('/me', verifyToken, me);

module.exports = router;
