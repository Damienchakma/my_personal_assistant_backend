/**
 * Error Handler Middleware
 * Catches and formats all errors in a consistent structure.
 */

/**
 * Express error handling middleware.
 * @param {Error} err - The error object.
 * @param {object} req - Express request object.
 * @param {object} res - Express response object.
 * @param {function} next - Express next function.
 */
const errorHandler = (err, req, res, next) => {
    console.error(`❌ Error in ${req.method} ${req.path}: ${err.message}`);

    const statusCode = err.statusCode || 500;
    const message = process.env.NODE_ENV === 'production'
        ? 'An unexpected error occurred.'
        : err.message;

    res.status(statusCode).json({
        success: false,
        error: message,
        code: err.code || 'INTERNAL_ERROR'
    });
};

module.exports = errorHandler;
