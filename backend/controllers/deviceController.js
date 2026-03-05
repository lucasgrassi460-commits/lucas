// We will use events or direct export from the whatsapp client to get status
const whatsappClient = require('../whatsapp/client');

exports.getStatus = (req, res) => {
    res.json({
        status: whatsappClient.getConnectionStatus(),
        qr: whatsappClient.getCurrentQR()
    });
};

exports.reconnect = (req, res) => {
    whatsappClient.reconnect();
    res.json({ success: true, message: 'Reconnection initiated' });
};
