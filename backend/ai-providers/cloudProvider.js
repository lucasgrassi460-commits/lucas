const axios = require('axios'); // Assuming axios is available, otherwise use fetch

const generateResponse = async ({ instructions, documents, history, message }) => {
    try {
        const apiKey = process.env.CLOUD_AI_KEY;
        if (!apiKey) {
            console.error("[Cloud AI] API Key missing");
            throw new Error("Cloud AI API Key missing");
        }

        const endpoint = process.env.CLOUD_AI_ENDPOINT || 'https://api.cloud-ai.com/v1/generate';

        const payload = {
            instructions,
            documents,
            history,
            message,
            apiKey
        };

        console.log(`[Cloud AI] Sending prompt to API (Endpoint: ${endpoint})`);

        const response = await axios.post(endpoint, payload);
        const text = response.data.text || response.data.message || response.data.content;

        console.log(`[Cloud AI] Response generated successfully.`);
        return text;

    } catch (error) {
        console.error("AI Provider Error [Cloud AI]:", error.message || error);
        if (error.response) {
            console.error("AI Provider Error Details [Cloud AI]:", JSON.stringify(error.response, null, 2));
        }
        throw error;
    }
};

module.exports = { generateResponse };