const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/verifyToken');
const requireAdmin = require('../middleware/requireAdmin');
const validate = require('../middleware/validate');
const schemas = require('../validators/schemas');
const { reviewQueue, approveResource, rejectResource, reportResource } = require('../controllers/resourceController');

const id = validate(schemas.objectId, 'params');

router.get('/review', verifyToken, requireAdmin, reviewQueue);
router.post('/:id/approve', verifyToken, requireAdmin, id, validate(schemas.reviewResource), approveResource);
router.post('/:id/reject', verifyToken, requireAdmin, id, validate(schemas.reviewResource), rejectResource);
router.post('/:id/report', verifyToken, id, validate(schemas.reportResource), reportResource);

module.exports = router;
