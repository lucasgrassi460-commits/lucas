require('dotenv').config();

console.log("--- AI Provider Credentials ---");
console.log("Gemini API key loaded:", !!process.env.GEMINI_API_KEY);
console.log("OpenAI API key loaded:", !!process.env.OPENAI_API_KEY);
console.log("Cloud AI key loaded:", !!process.env.CLOUD_AI_KEY);
console.log("-------------------------------");
const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: true }));

// Serve static files for frontend Dashboard
app.use(express.static(path.join(__dirname, '../public')));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Routes
app.use('/api/bots', require('./routes/botRoutes'));
app.use('/api/docs', require('./routes/docRoutes'));
app.use('/api/documents', require('./routes/docRoutes'));
app.use('/api/ai-agents', require('./routes/aiAgentRoutes'));
app.use('/api/metrics', require('./routes/metricRoutes'));
app.use('/api/device', require('./routes/deviceRoutes'));
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/payments', require('./routes/caktoRoutes'));
app.use('/api/conversations', require('./routes/conversationRoutes'));

// Test AI Endpoint
app.get('/test-ai', async (req, res) => {
    const { provider, message } = req.query;
    if (!provider || !message) {
        return res.status(400).json({ success: false, error: 'Missing provider or message query param' });
    }
    
    try {
        const { generateAIResponse } = require('./services/aiRouter');
        const response = await generateAIResponse({
            provider,
            instructions: 'You are a test assistant.',
            documents: 'No documents.',
            history: [],
            message
        });
        res.json({ success: true, provider, response });
    } catch (error) {
        res.status(500).json({ success: false, provider, error: error.message || String(error) });
    }
});

// Fallback to index.html for SPA
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

const { restoreSessions } = require('./whatsapp/sessionManager');
setTimeout(() => {
    restoreSessions().catch((err) => console.error('Error restoring sessions:', err));
}, 1000);

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});
