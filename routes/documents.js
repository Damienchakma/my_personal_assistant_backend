/**
 * Documents Routes
 * Handle file uploads and RAG ingestion.
 */
const express = require('express');
const router = express.Router();
const multer = require('multer');
const ragService = require('../services/ragService');

// Configure Multer for memory storage
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 15 * 1024 * 1024 } // 15MB limit
});

/**
 * POST /api/documents/upload
 * Upload a PDF or Text file for RAG ingestion.
 */
router.post('/upload', (req, res) => {
    upload.single('file')(req, res, async (err) => {
        if (err instanceof multer.MulterError) {
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({ success: false, error: 'File too large. Maximum size is 15MB.' });
            }
            return res.status(400).json({ success: false, error: err.message });
        } else if (err) {
            return res.status(500).json({ success: false, error: err.message });
        }

        try {
            if (!req.file) {
                return res.status(400).json({ success: false, error: 'No file uploaded' });
            }

            console.log(`📂 Received file: ${req.file.originalname} (${req.file.mimetype})`);

            const result = await ragService.ingestDocument(req.file);

            if (result.success) {
                res.json({
                    success: true,
                    message: 'Document ingested successfully',
                    chunks: result.chunks
                });
            } else {
                res.status(500).json({
                    success: false,
                    error: result.error
                });
            }

        } catch (error) {
            console.error('Upload Error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

module.exports = router;
