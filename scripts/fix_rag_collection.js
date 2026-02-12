const { GoogleGenerativeAIEmbeddings } = require("@langchain/google-genai");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function testModel(modelName) {
    console.log(`\n🧪 Testing model: "${modelName || 'DEFAULT'}"`);
    try {
        const config = {
            apiKey: process.env.GEMINI_API_KEY,
        };
        if (modelName) config.modelName = modelName;

        const embeddings = new GoogleGenerativeAIEmbeddings(config);
        const res = await embeddings.embedQuery("Hello world");
        console.log(`✅ Success! Dimension: ${res.length}`);
        return true;
    } catch (error) {
        console.log(`❌ Failed: ${error.message.substring(0, 100)}... status: ${error.status}`);
        return false;
    }
}

async function main() {
    console.log('🔍 Starting Model Discovery...');
    // Test Chat
    try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-pro" });
        const result = await model.generateContent("Hi");
        const text = result.response.text();
        console.log(`✅ CHAT (gemini-pro) WORKS! Response: ${text.substring(0, 20)}...`);
    } catch (e) {
        console.log(`❌ CHAT (gemini-pro) FAILED: ${e.message.substring(0, 100)}...`);
    }

    const models = [
        "gemini-embedding-001", "models/gemini-embedding-001",
        "text-embedding-004", "models/text-embedding-004",
        "embedding-001", "models/embedding-001",
        undefined
    ];

    for (const m of models) {
        if (await testModel(m)) {
            console.log(`\n🎉 FOUND WORKING MODEL: "${m || 'DEFAULT'}"`);
            return;
        }
    }
    console.log('\n❌ ALL EMBEDDING MODELS FAILED.');
}

main();
