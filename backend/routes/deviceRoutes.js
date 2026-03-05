const express = require('express');
const router = express.Router();
const deviceController = require('../controllers/deviceController');

router.get('/status', deviceController.getStatus);
router.post('/reconnect', deviceController.reconnect);

module.exports = router;
