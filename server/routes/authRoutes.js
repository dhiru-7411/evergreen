const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/verifyToken');
const { optionalAuth } = require('../middleware/verifyToken');
const validate = require('../middleware/validate');
const { authLimiter } = require('../middleware/rateLimits');
const schemas = require('../validators/schemas');
const auth = require('../controllers/authController');
const account = require('../controllers/accountController');

router.post('/register', authLimiter, validate(schemas.register), auth.register);
router.post('/login', authLimiter, validate(schemas.login), auth.login);
router.post('/refresh', authLimiter, auth.refresh);
router.post('/logout', optionalAuth, auth.logout);
router.post('/logout-all', verifyToken, auth.logoutEverywhere);
router.get('/me', verifyToken, auth.me);
router.get('/sessions', verifyToken, auth.listSessions);
router.delete('/sessions/:id', verifyToken, validate(schemas.objectId, 'params'), auth.revokeOne);

router.post('/verify-email', authLimiter, validate(schemas.verifyEmail), account.verifyEmail);
router.post('/resend-verification', verifyToken, authLimiter, account.resendVerification);
router.post('/forgot-password', authLimiter, validate(schemas.forgotPassword), account.forgotPassword);
router.post('/reset-password', authLimiter, validate(schemas.resetPassword), account.resetPassword);
router.post('/change-password', verifyToken, authLimiter, validate(schemas.changePassword), account.changePassword);

module.exports = router;
