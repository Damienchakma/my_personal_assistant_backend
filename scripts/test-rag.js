const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function test() {
    console.log('🧪 Testing RAG Service...');

    try {
        const ragService = require('../services/ragService');
        console.log('✅ Vector Store Connected');

        console.log('📝 Testing Embedding...');
        const embedding = await ragService.embeddings.embedQuery("Hello World");
        console.log(`✅ Embedding Generated (Length: ${embedding.length})`);

        console.log('🎉 RAG Service is Ready!');
    } catch (error) {
        console.error('❌ RAG Service Validation Failed:', error);
    }
}

test();
