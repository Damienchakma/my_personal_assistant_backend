const { MilvusClient, DataType } = require("@zilliz/milvus2-sdk-node");
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const COLLECTION_NAME = 'rag_collection_v3_gemini';

async function main() {
    console.log('🛠️ Starting Milvus Schema Reset...');
    const client = new MilvusClient({
        address: process.env.ZILLIZ_URI,
        token: process.env.ZILLIZ_TOKEN,
    });

    try {
        // 1. Check if exists
        const hasCol = await client.hasCollection({ collection_name: COLLECTION_NAME });
        if (hasCol.value) {
            console.log(`🗑️ Dropping existing collection: ${COLLECTION_NAME}`);
            await client.dropCollection({ collection_name: COLLECTION_NAME });
            console.log('✅ Dropped.');
        }

        // 2. Create with explicit schema
        console.log('🏗️ Creating new collection with permissive schema...');

        const schema = [
            {
                name: "langchain_primaryid",
                description: "Primary Key",
                data_type: DataType.Int64,
                is_primary_key: true,
                autoID: true,
            },
            {
                name: "langchain_text",
                description: "Document Text",
                data_type: DataType.VarChar,
                max_length: 65535,
            },
            {
                name: "langchain_vector",
                description: "Embedding Vector",
                data_type: DataType.FloatVector,
                dim: 3072,
            },
            {
                name: "source",
                description: "Source Filename",
                data_type: DataType.VarChar,
                max_length: 4096, // Plenty of space for filenames
            }
        ];

        await client.createCollection({
            collection_name: COLLECTION_NAME,
            fields: schema,
            enable_dynamic_field: true // Allow other metadata fields if needed (though they won't be indexed broadly like this)
        });

        // 3. Create Index
        console.log('⚡ Creating index...');
        await client.createIndex({
            collection_name: COLLECTION_NAME,
            field_name: "langchain_vector",
            index_type: "AUTOINDEX",
            metric_type: "L2"
        });

        console.log(`✅ Collection '${COLLECTION_NAME}' successfully reset with proper schema.`);
        console.log('Ready for uploads!');

    } catch (error) {
        console.error('❌ Schema Reset Failed:', error);
    }
}

main();
