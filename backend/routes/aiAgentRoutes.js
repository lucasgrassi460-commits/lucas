const express = require('express');
const router = express.Router();
const aiAgentController = require('../controllers/aiAgentController');
const { verifyToken } = require('../middleware/authMiddleware');

router.use(verifyToken);

router.get('/', aiAgentController.listAgents);
router.get('/:id', aiAgentController.getAgent);
router.post('/', aiAgentController.createAgent);
router.put('/:id', aiAgentController.updateAgent);
router.delete('/:id', aiAgentController.deleteAgent);

module.exports = router;
