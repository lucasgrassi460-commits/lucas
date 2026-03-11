const geminiProvider = require('../ai-providers/geminiProvider');
const openaiProvider = require('../ai-providers/openaiProvider');
const cloudProvider = require('../ai-providers/cloudProvider');

const generateAIResponse = async ({ provider, instructions, documents, history, message }) => {
    try {
        console.log(`[AI Router] Generating response for provider: ${provider}`);

        let response = null;

        switch (provider) {
            case 'gemini':
                response = await geminiProvider.generateResponse({ instructions, documents, history, message });
                break;
            case 'openai':
                response = await openaiProvider.generateResponse({ instructions, documents, history, message });
                break;
            case 'cloud':
                response = await cloudProvider.generateResponse({ instructions, documents, history, message });
                break;
            default:
                console.warn(`[AI Router] Unknown provider: ${provider}. Fallback to Gemini.`);
                response = await geminiProvider.generateResponse({ instructions, documents, history, message });
                break;
        }

        if (!response) {
            console.error("[AI Router] Empty response received.");
            throw new Error("Empty response");
        }

        return response;
    } catch (error) {
        console.error("[AI Router] Generation Error:", error.message || error);
        throw error;
    }
};

module.exports = { generateAIResponse };