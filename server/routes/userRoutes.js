const express = require('express');
const router = express.Router();
const validate = require('../middleware/validate');
const schemas = require('../validators/schemas');
const { getProfile } = require('../controllers/userController');

router.get('/:username', validate(schemas.username, 'params'), getProfile);

module.exports = router;
