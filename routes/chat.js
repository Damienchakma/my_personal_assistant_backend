/**
 * Chat API Routes
 * Endpoints for AI chat with intelligent web search.
 */

const express = require('express');
const router = express.Router();
const groqService = require('../services/groqService');

/**
 * POST /api/chat
 * Process a chat message with optional web search.
 */
router.post('/', async (req, res, next) => {
    try {
        const { message, conversationHistory = [], forceSearch = false } = req.body;

        // Validate input
        if (!message || typeof message !== 'string' || message.trim().length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Message is required and must be a non-empty string.',
                code: 'INVALID_INPUT'
            });
        }

        // Check for RAG flag
        const { useRAG } = req.body;
        let result;

        if (useRAG) {
            console.log(`📚 RAG Mode ENABLED for query: "${message}"`);
            // Lazy load ragService to avoid circular dependency issues or initialization delays
            const ragService = require('../services/ragService');
            result = await ragService.query(message.trim(), conversationHistory);
        } else {
            console.log(`💬 Standard Chat Mode for query: "${message}"`);
            // Standard Chat
            result = await groqService.chat(message.trim(), conversationHistory, forceSearch);
        }

        // Handle service-level errors
        if (result.success === false) {
            return res.status(500).json(result);
        }

        res.json({
            success: true,
            data: {
                response: result.response,
                searchPerformed: result.searchPerformed,
                searchQuery: result.searchQuery,
                searchTopic: result.searchTopic,
                sources: result.sources || []
            }
        });

    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/health
 * Health check endpoint.
 */
router.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: Date.now()
    });
});

module.exports = router;
