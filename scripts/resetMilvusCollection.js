/**
 * Reset Milvus Collection Script
 * Drops the existing collection and recreates it with proper varchar limits.
 * Run with: node scripts/resetMilvusCollection.js
 */
require('dotenv').config();
const { MilvusClient, DataType } = require('@zilliz/milvus2-sdk-node');

const COLLECTION_NAME = 'rag_collection_v3_gemini';
const EMBEDDING_DIM = 3072;

async function resetCollection() {
    const client = new MilvusClient({
        address: process.env.ZILLIZ_URI,
        token: process.env.ZILLIZ_TOKEN,
    });

    console.log('🔌 Connected to Milvus/Zilliz');

    // Drop collection if it exists
    try {
        const exists = await client.hasCollection({ collection_name: COLLECTION_NAME });
        if (exists.value) {
            console.log(`🗑️  Dropping existing collection: ${COLLECTION_NAME}`);
            await client.dropCollection({ collection_name: COLLECTION_NAME });
            console.log('✅ Collection dropped.');
        } else {
            console.log('ℹ️  Collection does not exist, will create fresh.');
        }
    } catch (e) {
        console.error('Error checking/dropping collection:', e.message);
    }

    await client.closeConnection();
    console.log('\n🎉 Done! Collection dropped. LangChain will recreate it with the correct schema on next upload.');
}

resetCollection().catch(err => {
    console.error('❌ Fatal error:', err);
    process.exit(1);
});
