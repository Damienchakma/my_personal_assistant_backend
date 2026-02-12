const express = require('express');
const router = express.Router();
const db = require('../config/database');

// GET all blogs
router.get('/', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM blogs ORDER BY created_at DESC');
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET one blog
router.get('/:id', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM blogs WHERE id = $1', [req.params.id]);
        if (result.rows.length === 0) return res.status(404).json({ message: 'Blog not found' });
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST a blog
router.post('/', async (req, res) => {
    const { title, content } = req.body;
    try {
        const result = await db.query(
            'INSERT INTO blogs (title, content) VALUES ($1, $2) RETURNING *',
            [title, content]
        );
        res.status(201).json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// PUT (update) a blog
router.put('/:id', async (req, res) => {
    const { title, content } = req.body;
    try {
        const result = await db.query(
            'UPDATE blogs SET title = $1, content = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *',
            [title, content, req.params.id]
        );
        if (result.rows.length === 0) return res.status(404).json({ message: 'Blog not found' });
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE a blog
router.delete('/:id', async (req, res) => {
    try {
        const result = await db.query('DELETE FROM blogs WHERE id = $1 RETURNING *', [req.params.id]);
        if (result.rows.length === 0) return res.status(404).json({ message: 'Blog not found' });
        res.json({ message: 'Blog deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
