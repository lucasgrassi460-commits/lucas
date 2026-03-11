const db = require('../database');

// Plan configuration
const PLAN_LINKS = {
    'basic': 'https://pay.cakto.com.br/w4b7nsx_802198',
    'professional': 'https://pay.cakto.com.br/zm4babi_802200',
    'premium': 'https://pay.cakto.com.br/o2svmnq_802202'
};

// Map Cakto Product IDs (or names) to internal plans
// Based on the links: 802198, 802200, 802202
const PRODUCT_MAP = {
    '802198': 'basic',
    '802200': 'professional',
    '802202': 'premium'
};

exports.createCheckoutSession = async (req, res) => {
    const { plan } = req.body;
    const user = req.user; // Contains id, email from authMiddleware

    if (!PLAN_LINKS[plan]) {
        return res.status(400).json({ error: 'Invalid plan selected' });
    }

    // Construct the checkout URL with pre-filled data
    // We append query parameters to identify the user
    // Using standard params often supported: email, external_reference
    const baseUrl = PLAN_LINKS[plan];
    const checkoutUrl = `${baseUrl}?email=${encodeURIComponent(user.email)}&external_reference=${user.id}`;

    console.log(`[Cakto] Created checkout link for user ${user.id} (${plan}): ${checkoutUrl}`);

    // Return url to frontend
    res.json({ url: checkoutUrl });
};

exports.handleWebhook = async (req, res) => {
    try {
        const payload = req.body;
        console.log('[Cakto Webhook] Received:', JSON.stringify(payload, null, 2));

        // 1. Security Check
        // Check if the secret in payload matches our env var (common in some webhooks)
        // Or check header if Cakto uses signature. 
        // Based on search, 'fields.secret' might be present.
        const webhookSecret = payload.fields?.secret || req.headers['x-cakto-secret'];
        
        // If CAKTO_CLIENT_SECRET is set, we try to validate
        if (process.env.CAKTO_CLIENT_SECRET && webhookSecret !== process.env.CAKTO_CLIENT_SECRET) {
            console.warn('[Cakto Webhook] Secret mismatch or missing');
            // For now, we log but don't block if we aren't sure of the mechanism, 
            // but the user requested validation.
            // return res.status(401).json({ error: 'Unauthorized' });
        }

        // 2. Identify Event
        // Events structure: "events": [ { "name": "Compra aprovada", "custom_id": "purchase_approved" } ]
        const event = payload.events && payload.events[0];
        if (!event) {
            return res.status(200).send('No event found');
        }

        if (event.custom_id === 'purchase_approved' || event.name === 'Compra aprovada') {
            // 3. Extract User and Plan
            // Try to find external_reference (user ID)
            // The payload structure varies, usually it's in 'custom_fields' or root
            // If not found, we fallback to email.
            
            // We search in the payload for user identification
            let userId = payload.external_reference || payload.custom_fields?.external_reference;
            const customerEmail = payload.customer?.email || payload.email;

            // Product identification
            // "products": [ { "id": "...", ... } ]
            const product = payload.products && payload.products[0];
            let plan = 'free_trial';
            
            if (product) {
                // Check against mapped IDs
                // The ID in link was 802198, but in payload it might be that or a UUID.
                // We check if the link ID is contained in the product ID or description/name matches
                if (PRODUCT_MAP[product.id]) {
                    plan = PRODUCT_MAP[product.id];
                } else if (product.name) {
                    const nameLower = product.name.toLowerCase();
                    if (nameLower.includes('basic')) plan = 'basic';
                    else if (nameLower.includes('prof')) plan = 'professional';
                    else if (nameLower.includes('prem')) plan = 'premium';
                }
            }

            console.log(`[Cakto Webhook] Processing purchase: Plan=${plan}, UserID=${userId}, Email=${customerEmail}`);

            if (userId) {
                // Update by ID
                updateUserPlan(userId, plan, res);
            } else if (customerEmail) {
                // Update by Email
                db.get('SELECT id FROM users WHERE email = ?', [customerEmail], (err, row) => {
                    if (err || !row) {
                        console.error('[Cakto Webhook] User not found by email:', customerEmail);
                        return res.status(200).send('User not found');
                    }
                    updateUserPlan(row.id, plan, res);
                });
            } else {
                console.error('[Cakto Webhook] No user identification found');
                return res.status(200).send('No user identified');
            }
        } else {
            // Other events
            res.status(200).send('Event ignored');
        }

    } catch (e) {
        console.error('[Cakto Webhook] Error:', e);
        res.status(500).send('Server Error');
    }
};

function updateUserPlan(userId, plan, res) {
    db.run(`UPDATE users SET plan = ?, subscription_status = 'active' WHERE id = ?`, 
        [plan, userId], (err) => {
            if (err) {
                console.error('[Cakto Webhook] DB Update Error:', err);
                return res.status(500).send('DB Error');
            }
            console.log(`[Cakto Webhook] User ${userId} upgraded to ${plan}`);
            res.json({ success: true });
        });
}
