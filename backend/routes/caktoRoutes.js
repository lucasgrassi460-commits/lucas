const express = require('express');
const router = express.Router();
const caktoController = require('../controllers/caktoController');
const { verifyToken } = require('../middleware/authMiddleware');

// Checkout creation requires auth
router.post('/create-checkout-session', verifyToken, caktoController.createCheckoutSession);

// Webhook is public (secured by secret check inside controller)
router.post('/cakto-webhook', caktoController.handleWebhook);

module.exports = router;
