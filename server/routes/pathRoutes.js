const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/verifyToken');
const requireAdmin = require('../middleware/requireAdmin');
const validate = require('../middleware/validate');
const schemas = require('../validators/schemas');
const { publish, reject } = require('../controllers/pathController');

const id = validate(schemas.objectId, 'params');

router.post('/:id/publish', verifyToken, requireAdmin, id, validate(schemas.reviewPath), publish);
router.post('/:id/reject', verifyToken, requireAdmin, id, validate(schemas.reviewPath), reject);

module.exports = router;
