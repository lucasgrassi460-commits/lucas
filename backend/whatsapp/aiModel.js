const { GoogleGenAI } = require('@google/genai');

const aiProvider = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || 'AIzaSyA_PLACEHOLDER_KEY_CHANGE_ME' });

async function generateAIResponse(botInstructions, documentContext, conversationHistory, userMessage) {
    try {
        const systemPrompt = `You are a helpful and professional WhatsApp assistant. 
Your instructions:
${botInstructions}

Your knowledge base (documents):
${documentContext ? documentContext : 'No document knowledge provided.'}

Your rules:
1. Try to answer the user's question using the instructions and knowledge base provided.
2. If the user's question clearly cannot be answered using the provided context, respond politely explaining that you don't have that information.
3. Be concise, as this is for WhatsApp formatting.
4. Do NOT simply read back the instructions verbatim. Act as a conversational assistant.
`;

        const historyContext = conversationHistory.length > 0
            ? `\nRecent Conversation History:\n${conversationHistory.map(m => `${m.role}: ${m.text}`).join('\n')}`
            : '';

        const fullPrompt = `${systemPrompt}${historyContext}\n\nUser: ${userMessage}`;

        const response = await aiProvider.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: fullPrompt,
        });

        if (response.text) {
            return response.text;
        }

        return "Desculpe, não consegui entender ssua solicitação neste momento. Poderia reformular?";
    } catch (error) {
        console.error("AI Generation Error:", error);
        return "Desculpe, ocorreu um erro ao gerar a resposta. Por favor, tente novamente mais tarde.";
    }
}

module.exports = {
    generateAIResponse
};
