const { MilvusClient } = require("@zilliz/milvus2-sdk-node");
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const COLLECTION_NAME = 'rag_collection_v3_gemini';

async function main() {
    console.log('🔍 Inspecting Milvus Schema...');
    const client = new MilvusClient({
        address: process.env.ZILLIZ_URI,
        token: process.env.ZILLIZ_TOKEN,
    });

    try {
        const desc = await client.describeCollection({ collection_name: COLLECTION_NAME });
        console.log('Collection Schema:', JSON.stringify(desc.schema.fields, null, 2));
    } catch (error) {
        console.error('❌ Failed to describe collection:', error);
    }
}

main();
