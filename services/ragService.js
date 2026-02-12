const { GoogleGenerativeAIEmbeddings } = require("@langchain/google-genai");
const { Milvus } = require("@langchain/community/vectorstores/milvus");
const { RecursiveCharacterTextSplitter } = require("@langchain/textsplitters");
const pdfParse = require('pdf-parse');
const groqService = require('./groqService');

require('dotenv').config();

// Configuration
const COLLECTION_NAME = 'rag_collection_v3_gemini';

class RAGService {
    constructor() {
        this.embeddings = new GoogleGenerativeAIEmbeddings({
            apiKey: process.env.GEMINI_API_KEY,
            modelName: "gemini-embedding-001", // 768 dimensions
        });

        this.vectorStore = null;
    }

    /**
     * Initialize or get the vector store instance
     */
    async getVectorStore() {
        if (!this.vectorStore) {
            console.log('🔌 Connecting to Milvus Vector Store...');
            try {
                // Direct instantiation ensures we always pass the configuration
                this.vectorStore = new Milvus(this.embeddings, {
                    collectionName: COLLECTION_NAME,
                    clientConfig: {
                        address: process.env.ZILLIZ_URI,
                        token: process.env.ZILLIZ_TOKEN,
                    },
                    collectionParams: {
                        metric_type: "L2",
                        auto_id: true,
                        description: "RAG Collection for Personal Assistant",
                        dimension: 3072,
                        dim: 3072, // Add alias effectively
                    },
                    autoId: true,
                    dim: 3072, // Add to root just in case
                });
                console.log('✅ Milvus Vector Store initialized.');
            } catch (error) {
                console.error('❌ Failed to initialize Milvus:', error);
                throw error;
            }
        }
        return this.vectorStore;
    }

    /**
     * Ingest a document (PDF or Text)
     * @param {Object} file - Multer file object
     */
    async ingestDocument(file) {
        try {
            let text = '';

            console.log(`📂 Ingesting file: ${file.originalname} (${file.mimetype})`);

            // Extract text based on mime type
            if (file.mimetype === 'application/pdf' || file.originalname.endsWith('.pdf')) {
                const pdfData = await pdfParse(file.buffer);
                text = pdfData.text;
            } else {
                text = file.buffer.toString('utf-8');
            }

            // Log a snippet but also save to file for inspection
            console.log(`📄 Extracted Document Text (${text.length} chars):`, text.substring(0, 200) + '...');
            require('fs').writeFileSync('last_extracted_text.txt', text);

            if (!text || text.trim().length === 0) {
                throw new Error('Extracted text is empty');
            }

            // Split text - Smaller chunks for better granularity on specific questions
            const splitter = new RecursiveCharacterTextSplitter({
                chunkSize: 800, // Increased slightly for markdown context
                chunkOverlap: 100,
            });

            const docs = await splitter.createDocuments([text], [{ source: file.originalname }]);
            console.log(`🧩 Split into ${docs.length} chunks.`);

            // Initialize Vector Store and add documents
            console.log('💾 Saving chunks to Milvus...');

            const vectorStore = await this.getVectorStore();
            await vectorStore.addDocuments(docs);

            console.log(`✅ Ingested ${docs.length} chunks from ${file.originalname}`);
            return { success: true, chunks: docs.length };

        } catch (error) {
            console.error('❌ Ingestion Error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Query documents and answer using Groq
     * @param {string} message - User query
     * @param {Array} history - Chat history
     */
    async query(message, history) {
        try {
            console.log(`🔎 Querying Milvus for: "${message}"`);
            const vectorStore = await this.getVectorStore();

            // value of k = 20 (Increased to ensure we capture relevant questions that might be scattered)
            const relevantDocs = await vectorStore.similaritySearch(message, 10);

            // Format context
            const context = relevantDocs.map(doc => doc.pageContent).join('\n\n');

            console.log(`🔍 Retrieved ${relevantDocs.length} relevant chunks`);
            if (relevantDocs.length > 0) {
                console.log('--- CONTEXT PREVIEW ---');
                console.log(context.substring(0, 500) + '...');
                console.log('-----------------------');
            } else {
                console.warn('⚠️ No relevant documents found via similarity search.');
            }

            // Delegate to Groq Service with context
            return await groqService.chat(message, history, false, context);

        } catch (error) {
            console.error('❌ RAG Query Error:', error);
            // Fallback to normal chat if RAG fails
            return await groqService.chat(message, history);
        }
    }
}

module.exports = new RAGService();
