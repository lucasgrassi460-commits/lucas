require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function testGemini() {
    const apiKey = process.env.GEMINI_API_KEY;
    const genAI = new GoogleGenerativeAI(apiKey);
    
    // logic to list models if possible, or just try another model
    // The SDK doesn't expose listModels directly on genAI instance easily in all versions?
    // Actually it might be via a separate manager.
    
    try {
        console.log("Trying gemini-1.5-flash...");
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent("Hi");
        console.log("Success with gemini-1.5-flash");
    } catch(e) {
        console.log("Failed gemini-1.5-flash:", e.message);
    }

    try {
        console.log("Trying gemini-pro...");
        const model = genAI.getGenerativeModel({ model: "gemini-pro" });
        const result = await model.generateContent("Hi");
        console.log("Success with gemini-pro");
    } catch(e) {
        console.log("Failed gemini-pro:", e.message);
    }
}

testGemini();