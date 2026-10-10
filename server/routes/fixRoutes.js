const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/verifyToken');
const { optionalAuth } = require('../middleware/verifyToken');
const validate = require('../middleware/validate');
const schemas = require('../validators/schemas');
const { inbox, mine, getFix, mergeFix, rejectFix } = require('../controllers/fixController');

router.get('/inbox', verifyToken, inbox);
router.get('/mine', verifyToken, mine);
router.get('/:fixId', optionalAuth, getFix);
router.post('/:fixId/merge', verifyToken, validate(schemas.mergeFix), mergeFix);
router.post('/:fixId/reject', verifyToken, validate(schemas.rejectFix), rejectFix);

module.exports = router;
