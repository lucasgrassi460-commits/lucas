const express = require('express');
const router = express.Router();
const botController = require('../controllers/botController');

router.get('/', botController.getBots);
router.post('/', botController.createBot);
router.get('/:id', botController.getBot);
router.put('/:id', botController.updateBot);
router.delete('/:id', botController.deleteBot);

// Q&A
router.post('/:id/qa', botController.addBotQA);
router.delete('/:id/qa/:qaId', botController.deleteBotQA);

module.exports = router;
