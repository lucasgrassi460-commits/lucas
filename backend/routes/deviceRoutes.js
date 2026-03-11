const express = require('express');
const router = express.Router();
const deviceController = require('../controllers/deviceController');
const { verifyToken } = require('../middleware/authMiddleware');

router.use(verifyToken);

router.get('/status', deviceController.getStatus);
router.post('/reconnect', deviceController.reconnect);

router.post('/session/create', deviceController.createSession);
router.put('/session/:id', deviceController.updateSession);
router.get('/session/list', deviceController.listSessions);
router.get('/session/:id/status', deviceController.getSessionStatus);
router.post('/session/:id/disconnect', deviceController.disconnectSession);

module.exports = router;
