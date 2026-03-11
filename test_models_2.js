require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function testGemini() {
    const apiKey = process.env.GEMINI_API_KEY;
    const genAI = new GoogleGenerativeAI(apiKey);
    
    const modelsToTry = [
        "gemini-1.5-flash-001",
        "gemini-1.5-flash-latest",
        "gemini-1.0-pro",
        "gemini-pro-vision"
    ];

    for (const m of modelsToTry) {
        try {
            console.log(`Trying ${m}...`);
            const model = genAI.getGenerativeModel({ model: m });
            const result = await model.generateContent("Hi");
            console.log(`✅ Success with ${m}`);
            return;
        } catch(e) {
            console.log(`❌ Failed ${m}:`, e.message);
        }
    }
}

testGemini();