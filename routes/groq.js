const express = require('express');
const router = express.Router();
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');
const Groq = require('groq-sdk');
const fs = require('fs');

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
});

// Configure Multer for Audio Uploads (STT)
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Chat Completion Proxy
router.post('/chat', async (req, res) => {
    try {
        const { messages, model, temperature, max_tokens, stream } = req.body;

        const chatCompletion = await groq.chat.completions.create({
            messages,
            model: model || 'llama-3.1-8b-instant',
            temperature: temperature || 0.7,
            max_tokens: max_tokens || 1024,
            stream: stream || false,
        });

        res.json(chatCompletion);
    } catch (error) {
        console.error('Groq Chat Proxy Error:', error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to process AI request' });
    }
});

// Speech-to-Text (STT) Proxy
router.post('/stt', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No audio file provided' });
        }

        const formData = new FormData();
        formData.append('file', req.file.buffer, {
            filename: req.file.originalname || 'audio.m4a',
            contentType: req.file.mimetype || 'audio/m4a',
        });
        formData.append('model', req.body.model || 'whisper-large-v3-turbo');

        const response = await axios.post('https://api.groq.com/openai/v1/audio/transcriptions', formData, {
            headers: {
                ...formData.getHeaders(),
                'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
            },
        });

        res.json(response.data);
    } catch (error) {
        console.error('Groq STT Proxy Error:', error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to transcribe audio' });
    }
});

// Text-to-Speech (TTS) Proxy
router.post('/tts', async (req, res) => {
    try {
        const { input, model, voice, response_format } = req.body;

        const response = await axios.post('https://api.groq.com/openai/v1/audio/speech', {
            input,
            model: model || 'canopylabs/orpheus-v1-english',
            voice: voice || 'hannah',
            response_format: response_format || 'mp3',
        }, {
            headers: {
                'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
                'Content-Type': 'application/json',
            },
            responseType: 'arraybuffer',
        });

        res.set('Content-Type', response.headers['content-type']);
        res.send(response.data);
    } catch (error) {
        console.error('Groq TTS Proxy Error:', error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to synthesize speech' });
    }
});

module.exports = router;
