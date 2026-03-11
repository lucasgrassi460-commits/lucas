const OpenAI = require('openai');

const generateResponse = async ({ instructions, documents, history, message }) => {
    try {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
            console.error("[OpenAI] API Key missing");
            throw new Error("OpenAI API Key missing");
        }

        const openai = new OpenAI({ apiKey });
        const model = "gpt-3.5-turbo"; // Default model

        const systemMessage = `You are a helpful and professional WhatsApp assistant. 
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

        const messages = [
            { role: "system", content: systemMessage },
            ...history.map(m => ({
                role: m.role === "user" ? "user" : "assistant",
                content: m.text
            })),
            { role: "user", content: message }
        ];

        console.log(`[OpenAI] Sending prompt to API (Length: ${messages.length} messages)`);

        const completion = await openai.chat.completions.create({
            messages,
            model,
        });

        const text = completion.choices[0].message.content;

        console.log(`[OpenAI] Response generated successfully.`);
        return text;

    } catch (error) {
        console.error("AI Provider Error [OpenAI]:", error.message || error);
        if (error.response) {
            console.error("AI Provider Error Details [OpenAI]:", JSON.stringify(error.response, null, 2));
        }
        throw error;
    }
};

module.exports = { generateResponse };