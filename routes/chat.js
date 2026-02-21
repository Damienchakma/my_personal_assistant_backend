/**
 * Chat API Routes
 * Endpoints for AI chat with intelligent web search.
 * Includes SSE streaming endpoint for real-time search progress.
 */

const express = require('express');
const router = express.Router();
const groqService = require('../services/groqService');

/**
 * POST /api/chat
 * Process a chat message with optional web search.
 * Returns the final result (non-streaming).
 */
router.post('/', async (req, res, next) => {
    try {
        const { message, conversationHistory = [], forceSearch = false } = req.body;

        if (!message || typeof message !== 'string' || message.trim().length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Message is required and must be a non-empty string.',
                code: 'INVALID_INPUT'
            });
        }

        const { useRAG } = req.body;
        let result;

        // Handle context if provided in req.body.documentContexts array
        let context = '';
        if (req.body.documentContexts && Array.isArray(req.body.documentContexts) && req.body.documentContexts.length > 0) {
            context = req.body.documentContexts.join('\n\n---\n\n');
        }

        console.log(`💬 AI Chat Mode for query: "${message}" (forceSearch: ${forceSearch}, deepSearch: ${req.body.deepSearch}, hasContext: ${!!context})`);
        result = await groqService.chat(message.trim(), conversationHistory, {
            forceSearch,
            isDeepResearch: !!req.body.deepSearch,
            context
        });

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
                sources: result.sources || [],
                searchSteps: result.searchSteps || [],
                totalSteps: result.totalSteps || 0,
                totalSearches: result.totalSearches || 0
            }
        });

    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/chat/stream
 * SSE streaming endpoint for real-time search progress.
 * Sends events as the agentic loop executes, then the final result.
 *
 * Event format: data: { type, message, step?, ... }\n\n
 * Final event: data: { type: "result", data: { response, sources, ... } }\n\n
 */
router.post('/stream', async (req, res) => {
    try {
        const { message, conversationHistory = [], forceSearch = false, useRAG = false } = req.body;

        if (!message || typeof message !== 'string' || message.trim().length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Message is required.',
                code: 'INVALID_INPUT'
            });
        }

        // Set up SSE headers
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
        res.flushHeaders();

        // Helper to send SSE events
        const sendEvent = (event) => {
            try {
                res.write(`data: ${JSON.stringify(event)}\n\n`);
            } catch (e) {
                console.error('[SSE] Write error:', e.message);
            }
        };

        // Progress callback for the agentic loop
        const onProgress = (event) => {
            sendEvent(event);
        };

        // Start heartbeat to prevent timeouts during long LLM thinking
        const heartbeatInterval = setInterval(() => {
            try {
                // Sending a comment in SSE keeps the connection alive but is ignored by parsers
                res.write(': heartbeat\n\n');
            } catch (e) {
                console.error('[SSE] Heartbeat error:', e.message);
            }
        }, 15000); // Every 15 seconds

        let result;

        // Handle context if provided in req.body.documentContexts array
        let context = '';
        if (req.body.documentContexts && Array.isArray(req.body.documentContexts) && req.body.documentContexts.length > 0) {
            context = req.body.documentContexts.join('\n\n---\n\n');
        }

        // Call groqService with progress callback
        result = await groqService.chat(
            message.trim(),
            conversationHistory,
            {
                forceSearch,
                isDeepResearch: !!req.body.deepSearch,
                context
            },
            onProgress // real-time progress callback
        );

        clearInterval(heartbeatInterval);

        if (result.success === false) {
            sendEvent({ type: 'error', message: result.error });
        } else {
            // Send final result
            sendEvent({
                type: 'result',
                data: {
                    response: result.response,
                    searchPerformed: result.searchPerformed,
                    searchQuery: result.searchQuery,
                    searchTopic: result.searchTopic,
                    sources: result.sources || [],
                    searchSteps: result.searchSteps || [],
                    totalSteps: result.totalSteps || 0,
                    totalSearches: result.totalSearches || 0
                }
            });
        }

        // Close the stream
        sendEvent({ type: 'done' });
        res.end();

    } catch (error) {
        console.error('[SSE] Stream error:', error.message);
        try {
            res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
            res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
            res.end();
        } catch (e) {
            res.end();
        }
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
