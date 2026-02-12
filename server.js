const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const db = require('./config/database');
const errorHandler = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 3000;

// Rate Limiting: 100 requests per 15 minutes per IP
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { success: false, error: 'Too many requests. Please try again later.', code: 'RATE_LIMIT' }
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(limiter);

// Request Logging
app.use((req, res, next) => {
    res.on('finish', () => {
        console.log(`${req.method} ${req.path} - ${res.statusCode}`);
    });
    next();
});

// Health check route
app.get('/', (req, res) => {
    res.json({
        message: 'Personal Assistant API',
        status: 'running'
    });
});

// Database test route
app.get('/api/db-test', async (req, res) => {
    try {
        const result = await db.query('SELECT NOW()');
        res.json({
            success: true,
            message: 'Database connection successful',
            timestamp: result.rows[0].now
        });
    } catch (error) {
        console.error('Database test error:', error);
        res.status(500).json({
            success: false,
            message: 'Database connection failed',
            error: error.message
        });
    }
});

// API Routes
app.use('/api/blogs', require('./routes/blogs'));
app.use('/api/groq', require('./routes/groq'));
app.use('/api/chat', require('./routes/chat'));
app.use('/api/documents', require('./routes/documents'));

// Error handling middleware (must be last)
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server is running on port ${PORT}`);
    console.log(`📍 http://localhost:${PORT}`);
});
