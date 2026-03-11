const { GoogleGenerativeAI } = require('@google/generative-ai');

const generateResponse = async ({ instructions, documents, history, message }) => {
    try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            console.error("[Gemini] API Key missing");
            throw new Error("Gemini API Key missing");
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        // Using gemini-2.0-flash as it is the current stable model for this environment
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

        const systemPrompt = `You are a helpful and professional WhatsApp assistant. 
Your instructions:
${instructions || ''}

Your knowledge base (documents):
${documents || 'No document knowledge provided.'}

Your rules:
1. Try to answer the user's question using the instructions and knowledge base provided.
2. If the user's question clearly cannot be answered using the provided context, respond politely explaining that you don't have that information.
3. Be concise, as this is for WhatsApp formatting.
4. Do NOT simply read back the instructions verbatim. Act as a conversational assistant.
`;

        const historyContext = history && history.length > 0
            ? `\nRecent Conversation History:\n${history.map(m => `${m.role}: ${m.text}`).join('\n')}`
            : '';

        const fullPrompt = `${systemPrompt}${historyContext}\n\nUser: ${message}`;

        console.log(`[Gemini] Sending prompt to API (Length: ${fullPrompt.length} chars)`);

        const result = await model.generateContent(fullPrompt);
        const response = await result.response;
        const text = response.text();

        console.log(`[Gemini] Response generated successfully.`);
        return text;

    } catch (error) {
        console.error("AI Provider Error [Gemini]:", error.message || error);
        if (error.response) {
            console.error("AI Provider Error Details [Gemini]:", JSON.stringify(error.response, null, 2));
        }
        throw error; // Re-throw to be handled by the router
    }
};

module.exports = { generateResponse };