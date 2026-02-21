/**
 * Tavily Search Service
 * Provides web search capabilities using the Tavily API.
 */

const axios = require('axios');

const TAVILY_API_URL = 'https://api.tavily.com/search';
const TAVILY_API_KEY = process.env.TAVILY_API_KEY;

/**
 * Tavily Search Service Class
 */
class TavilyService {
    /**
     * Performs a web search using the Tavily API.
     * @param {object} options - Search options.
     * @param {string} options.query - The search query (required).
     * @param {string} [options.topic='general'] - The topic type ('general' or 'news').
     * @param {number} [options.max_results=5] - Maximum number of results (1-10).
     * @param {boolean} [options.include_answer=true] - Whether to include a direct answer.
     * @param {boolean} [options.include_raw_content=false] - Whether to include raw content.
     * @param {boolean} [options.include_images=false] - Whether to include images.
     * @returns {Promise<object>} - Formatted search results or error object.
     */
    async search(options) {
        const {
            query,
            topic = 'general',
            max_results = 5,
            search_depth = 'basic',
            include_answer = true,
            include_raw_content = false,
            include_images = false
        } = options;

        if (!query || typeof query !== 'string') {
            return { success: false, error: 'Query is required and must be a string.', code: 'INVALID_QUERY' };
        }

        if (!TAVILY_API_KEY) {
            console.error('❌ Error in TavilyService.search: TAVILY_API_KEY is not set.');
            return { success: false, error: 'Search service configuration error.', code: 'CONFIG_ERROR' };
        }

        try {
            console.log(`🔍 Searching Tavily: "${query}" (topic: ${topic}, depth: ${search_depth}, max: ${max_results})`);

            const response = await axios.post(TAVILY_API_URL, {
                query,
                topic,
                search_depth,
                max_results,
                include_answer,
                include_raw_content,
                include_images
            }, {
                headers: {
                    'Authorization': `Bearer ${TAVILY_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                timeout: 15000
            });

            return {
                success: true,
                answer: response.data.answer,
                results: this.formatResults(response.data),
                sources: this.extractSources(response.data)
            };

        } catch (error) {
            return this.handleError(error);
        }
    }

    /**
     * Formats the Tavily API response into a clean text string for LLM consumption.
     * @param {object} response - The raw Tavily API response.
     * @returns {string} - Formatted string of search results.
     */
    formatResults(response) {
        if (!response || !response.results || response.results.length === 0) {
            return 'No results found.';
        }

        const formattedResults = response.results.map(result => {
            return `Title: ${result.title}\nContent: ${result.content}\nSource: ${result.url}\nScore: ${result.score}`;
        });

        return formattedResults.join('\n\n');
    }

    /**
     * Extracts source metadata for frontend display.
     * @param {object} response - The raw Tavily API response.
     * @returns {Array} - Array of source objects with title, url, and favicon.
     */
    extractSources(response) {
        if (!response || !response.results || response.results.length === 0) {
            return [];
        }

        return response.results.map(result => {
            const url = new URL(result.url);
            return {
                title: result.title,
                url: result.url,
                domain: url.hostname.replace('www.', ''),
                favicon: `https://www.google.com/s2/favicons?domain=${url.hostname}&sz=32`
            };
        });
    }

    /**
     * Handles errors from the Tavily API.
     * @param {Error} error - The error object.
     * @returns {object} - Structured error object.
     */
    handleError(error) {
        const status = error.response?.status;
        let message = 'Search service temporarily unavailable.';
        let code = 'TAVILY_ERROR';

        if (status === 429) {
            message = 'Search rate limit exceeded. Please try again in a few minutes.';
            code = 'RATE_LIMIT';
        } else if (status === 401 || status === 403) {
            message = 'Tavily API key is invalid or expired.';
            code = 'AUTH_ERROR';
        } else if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
            message = 'Search request timed out. Please try again.';
            code = 'TIMEOUT';
        }

        console.error(`❌ Error in TavilyService.search: ${error.message}`);
        return { success: false, error: message, code };
    }
    /**
     * Extracts full content from specific URLs using the Tavily Extract API.
     * @param {string[]} urls - Array of URLs to extract content from.
     * @returns {Promise<object>} - Extracted content or error object.
     */
    async extract(urls) {
        if (!urls || !Array.isArray(urls) || urls.length === 0) {
            return { success: false, error: 'URLs array is required.', code: 'INVALID_URLS' };
        }

        if (!TAVILY_API_KEY) {
            console.error('❌ Error in TavilyService.extract: TAVILY_API_KEY is not set.');
            return { success: false, error: 'Extraction service configuration error.', code: 'CONFIG_ERROR' };
        }

        try {
            console.log(`📄 Extracting content from ${urls.length} URLs...`);

            const response = await axios.post('https://api.tavily.com/extract', {
                urls
            }, {
                headers: {
                    'Authorization': `Bearer ${TAVILY_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                timeout: 30000 // Extraction can take longer
            });

            return {
                success: true,
                results: response.data.results, // Raw results from Tavily
                failed_results: response.data.failed_results
            };

        } catch (error) {
            return this.handleError(error);
        }
    }
}

module.exports = new TavilyService();
