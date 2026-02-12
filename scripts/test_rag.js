const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const ragService = require('../services/ragService');
const fs = require('fs');

// Mock Multer File Object
const mockFile = {
    originalname: 'this_is_a_very_long_filename_to_test_milvus_schema_fix.txt',
    mimetype: 'text/plain',
    buffer: Buffer.from(`
        The Project "Personal Assistant" is a comprehensive AI project designed to help the user with daily tasks.
        It has a backend built with Node.js and Express, and a frontend built with React Native (Expo).
        The database used is PostgreSQL.
        The AI models used are Gemini for embeddings and Groq/Llama 3 for chat.
        Key features include:
        1. RAG (Retrieval Augmented Generation) for document Q&A.
        2. Web Search via Tavily.
        3. Simple chat interface.
        4. User authentication (planned).
        The developer's name is Damien.
    `)
};

async function runTest() {
    console.log('🧪 Starting RAG Test...');

    // 1. Ingest
    console.log('\n--- Step 1: Ingestion ---');
    const ingestResult = await ragService.ingestDocument(mockFile);
    if (!ingestResult.success) {
        require('fs').writeFileSync('last_rag_error.json', JSON.stringify(ingestResult.error, null, 2));
        console.error('❌ Ingestion failed. See last_rag_error.json');
        return;
    }
    console.log('✅ Ingestion Successful');

    // 2. Query
    console.log('\n--- Step 2: Querying ---');
    const query = "What is the tech stack of the Personal Assistant project?";
    console.log(`Question: "${query}"`);

    const response = await ragService.query(query, []);

    console.log('\n--- Step 3: Response ---');
    console.log('AI Response:', response.response);

    if (response.response.includes('Node.js') || response.response.includes('React Native')) {
        console.log('\n✅ TEST PASSED: AI retrieved correct information.');
    } else {
        console.log('\n❌ TEST FAILED: AI did not mention expected validation keywords.');
    }
}

runTest().catch(console.error);
