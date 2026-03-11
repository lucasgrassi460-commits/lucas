require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function testGemini() {
    console.log("Testing Gemini API...");
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error("❌ GEMINI_API_KEY not found in environment.");
        return;
    }
    console.log("✅ GEMINI_API_KEY found:", apiKey.substring(0, 5) + "...");

    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        // Using gemini-2.0-flash as 1.5 might be deprecated in this environment
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" }); 
        console.log("Sending prompt: 'Hello, are you working?'");
        const result = await model.generateContent("Hello, are you working?");
        const response = await result.response;
        console.log("✅ Response received:", response.text());
    } catch (error) {
        console.error("❌ Gemini API Error:", error.message);
    }
}

testGemini();