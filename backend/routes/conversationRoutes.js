const express = require('express');
const router = express.Router();
const conversationController = require('../controllers/conversationController');

router.get('/', conversationController.getConversations);
router.get('/:phone/messages', conversationController.getMessages);

module.exports = router;