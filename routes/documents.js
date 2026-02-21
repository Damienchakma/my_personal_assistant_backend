/**
 * Documents Routes
 * Handle file uploads and RAG ingestion.
 */
const express = require('express');
const router = express.Router();
const multer = require('multer');
const ragService = require('../services/ragService');

const log = (emoji, msg) => console.log(`[DOCS] ${emoji} ${msg}`);

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
    log('📩', `Received POST /upload | Content-Type: ${req.headers['content-type'] || 'unknown'}`);
    upload.single('file')(req, res, async (err) => {
        if (err instanceof multer.MulterError) {
            log('❌', `Multer error: ${err.code} — ${err.message}`);
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({ success: false, error: 'File too large. Maximum size is 15MB.' });
            }
            return res.status(400).json({ success: false, error: err.message });
        } else if (err) {
            log('❌', `Upload middleware error: ${err.message}`);
            return res.status(500).json({ success: false, error: err.message });
        }

        try {
            if (!req.file) {
                log('⚠️', 'No file found in request. Ensure field name is "file" and Content-Type is multipart/form-data.');
                return res.status(400).json({ success: false, error: 'No file uploaded. Ensure field name is "file".' });
            }

            log('📂', `File received: "${req.file.originalname}" | MIME: ${req.file.mimetype} | Size: ${req.file.size} bytes`);

            const result = await ragService.processDocument(req.file);

            if (result.success) {
                log('✅', `Extraction complete: ${result.text.length} chars from "${req.file.originalname}"`);
                res.json({
                    success: true,
                    message: 'Document text extracted successfully',
                    text: result.text
                });
            } else {
                log('❌', `Extraction failed: ${result.error}`);
                res.status(500).json({
                    success: false,
                    error: result.error
                });
            }

        } catch (error) {
            log('❌', `Unhandled upload error: ${error.message}`);
            console.error('[DOCS] Stack:', error.stack);
            res.status(500).json({ success: false, error: error.message });
        }
    });
});

module.exports = router;
