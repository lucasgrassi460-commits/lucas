const express = require('express');
const router = express.Router();
const metricController = require('../controllers/metricController');

router.get('/', metricController.getMetrics);

module.exports = router;
