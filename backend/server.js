const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files for frontend Dashboard
app.use(express.static(path.join(__dirname, '../public')));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Routes
app.use('/api/bots', require('./routes/botRoutes'));
app.use('/api/docs', require('./routes/docRoutes'));
app.use('/api/metrics', require('./routes/metricRoutes'));
app.use('/api/device', require('./routes/deviceRoutes'));

// Fallback to index.html for SPA
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Initialize WhatsApp Client gracefully
const { initWhatsApp } = require('./whatsapp/client');
setTimeout(() => {
    initWhatsApp().catch(err => console.error("Error initializing WhatsApp:", err));
}, 1000);

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
