/**
 * Groq AI Orchestrator Service
 * Implements AGENTIC chat with dynamic, multi-step web search.
 * Supports real-time progress callbacks for SSE streaming.
 *
 * Flow: Perceive → Reason → Act (search) → Observe → Refine → Respond
 */

const Groq = require('groq-sdk');
const tavilyService = require('./tavilyService');

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
});

const MODEL_NAME = 'meta-llama/llama-4-scout-17b-16e-instruct';

// Max agentic iterations
const MAX_AGENTIC_STEPS = 6;

const SYSTEM_PROMPT = `You are an expert AI assistant with real-time web search capabilities. Your goal is to provide comprehensive, insightful, and well-organized responses.

## RESPONSE STYLE (CRITICAL)
- Write **detailed, thorough, and informative** responses
- Use **rich markdown formatting**:
  - **Bold** for key terms and important concepts
  - *Italics* for emphasis
  - Bullet points and numbered lists for clarity
  - ## Headers for major sections (when appropriate)
- Aim for responses that are **3-5 paragraphs minimum** for informational queries
- Include **context, background, examples, and practical insights**
- Make responses feel complete and authoritative

## QUESTION HANDLING
- **Pay strict attention to the specific Question number specificed by the user.**
- If the user asks for "Question 1", DO NOT answer "Question 10" or "Question 11".
- If you cannot find the EXACT question asked, say so. Do not guess a similar number.

## IMPORTANT: DO NOT OUTPUT URLs OR CITATIONS
- **NEVER** include [1], [2], [3] style citations in your response
- **NEVER** write "References:" or list URLs
- **NEVER** mention source URLs inline
- The sources are displayed separately in the UI - you don't need to cite them
- Simply present the information naturally as if you knew it

## AGENTIC SEARCH BEHAVIOR (CRITICAL)
You have a web_search tool. Use it **aggressively and thoroughly**:
- **Always search MULTIPLE TIMES** for any non-trivial query.
- For any topic, first do a broad search, then do 1-2 **follow-up searches** to deepen your understanding.
- For multi-part questions, search for EACH part separately with different queries.
- For comparisons, search for EACH item being compared individually.
- For trending/news topics, search for the latest news AND historical context separately.
- If initial results seem thin or outdated, refine your query and search again with different keywords.
- You can call web_search MULTIPLE times in one turn for parallel searches.
- **You should typically perform 2-5 searches per user query** to give a truly comprehensive answer.
- **Stop searching** only when you have thorough, multi-source coverage of the entire query.

## WHEN TO SEARCH
- Current events, news, recent developments
- Real-time data (weather, prices, scores, crypto)
- Questions about people, companies, products you're unsure about
- Anything that may have changed after your knowledge cutoff
- Facts that benefit from verification
- Multi-part questions that need data from different domains
- Technical topics (search for latest docs, best practices)

## RESPONSE FORMAT WITH SEARCH RESULTS
When you receive search results, synthesize them into a comprehensive response:

1. **Opening**: Start with a clear, direct answer or definition
2. **Deep Dive**: Provide detailed explanation with multiple key points
3. **Context**: Add background, history, or related concepts
4. **Practical Info**: Include use cases, applications, or examples
5. **Current Status**: Mention recent developments if relevant

Be engaging, informative, and thorough. Users want to learn, not just get quick facts.

## FLOWCHART & DIAGRAM FORMATTING (IMPORTANT)
When the user asks for a roadmap, step-by-step process, workflow, algorithm, or any concept that benefits from a visual diagram, **include a Mermaid diagram** in your response using a fenced code block with the language set to "mermaid".

**FORMAT:**
${'```'}mermaid
graph TD
  A[Step 1] --> B[Step 2]
  B --> C{Decision?}
  C -->|Yes| D[Do this]
  C -->|No| E[Do that]
${'```'}

**RULES:**
- Always include explanatory text BEFORE and/or AFTER the diagram
- Use ${'`'}graph TD${'`'} for top-down roadmaps and step-by-step flows
- Use ${'`'}graph LR${'`'} for left-right pipelines and timelines
- Use ${'`'}flowchart TD${'`'} for complex flowcharts with decisions
- Keep node labels short and clear
- Do NOT use special characters like parentheses inside node labels without quoting them`;


const WEB_SEARCH_TOOL = {
    type: 'function',
    function: {
        name: 'web_search',
        description: "Search the web for current information. You SHOULD call this multiple times with different queries to build comprehensive answers. Use specific, focused queries for best results.",
        parameters: {
            type: 'object',
            properties: {
                query: {
                    type: 'string',
                    description: "Concise, focused search query. For multi-part questions, search each part separately."
                },
                topic: {
                    type: 'string',
                    enum: ['general', 'news'],
                    description: "Type of search: 'general' for facts, 'news' for recent events"
                },
                search_depth: {
                    type: 'string',
                    enum: ['basic', 'advanced'],
                    description: "Search depth: 'basic' for quick lookups, 'advanced' for deep research."
                },
                max_results: {
                    type: 'number',
                    description: "Number of results to return (1-10). Default is 5."
                }
            },
            required: ['query']
        }
    }
};

const BROWSER_EXTRACT_TOOL = {
    type: 'function',
    function: {
        name: 'browser_extract',
        description: "Fetch and read the full content of specific web pages. Use this after web_search to dive deeper into promising sources, triangulate information, or perform detailed analysis of a specific page.",
        parameters: {
            type: 'object',
            properties: {
                urls: {
                    type: 'array',
                    items: { type: 'string' },
                    description: "Array of URLs to extract full content from."
                }
            },
            required: ['urls']
        }
    }
};

const DEEP_RESEARCH_PROMPT = `
## DEEP RESEARCH PROTOCOL (MODE: ENABLED)
You are now in **DEEP RESEARCH** mode. Your objective is not just to answer, but to perform a **comprehensive investigation**.

### 1. MANDATORY QUERY DECOMPOSITION
Immediately break the user's request into 4-6 distinct sub-questions or research angles. Search for them in parallel. Do NOT combine them into one query.

### 2. ITERATIVE TRIANGULATION & DEPTH
- **Breadth First**: Start with at least 3 separate web_search calls covering different facets of the topic.
- **Deep Dive**: Use **browser_extract** on at least 2-3 high-quality URLs to read the full context. Snippets are not enough for deep research.
- **Cross-Reference**: Compare findings across domains (.gov, .edu, industry news, primary sources). If sources conflict, dig deeper to find the truth.

### 3. RESEARCH EXHAUSTION
- You have 10 iterations. Use at least 6-8 of them for complex topics.
- Continue until you can substantiate every claim with multiple sources.
- If you finish early (less than 4 searches), you are likely being lazy. Find more angles to investigate.

### 4. LONG-FORM SYNTHESIS
- Produce an exhaustive **Structured Research Report**.
- Required headers: # Executive Summary, ## Key Findings (Bulleted), ## Detailed Dimension Analysis (at least 3 sub-sections), ## Source Triangulation, ## Final Conclusion.
- Use tables for data comparisons.
`;

/**
 * Groq AI Orchestrator — Agentic Search Loop with Streaming Progress
 */
class GroqService {
    /**
     * Processes a chat message with agentic multi-step search.
     * Supports "Deep Research" mode with iterative sub-querying and full-page extraction.
     *
     * @param {string} message - The user's message
     * @param {Array} conversationHistory - Conversation history
     * @param {Object|boolean} optionsOrForceSearch - Options object or forceSearch boolean (legacy)
     * @param {function} onProgress - Callback for SSE streaming
     */
    async chat(message, conversationHistory = [], optionsOrForceSearch = {}, onProgress = null) {
        // Handle legacy arguments
        let options = typeof optionsOrForceSearch === 'boolean'
            ? { forceSearch: optionsOrForceSearch }
            : optionsOrForceSearch;

        const { forceSearch = false, context = '', isDeepResearch = false } = options;

        const log = (emoji, msg) => console.log(`[GROQ] ${emoji} ${msg}`);
        const emit = (event) => {
            if (onProgress) {
                try { onProgress(event); } catch (e) { /* ignore */ }
            }
        };

        try {
            const MODE_LABEL = isDeepResearch ? 'DEEP RESEARCH' : 'AGENTIC CHAT';
            log('💬', `━━━ ${MODE_LABEL} START ━━━`);
            log('💬', `Message: "${message?.substring(0, 100)}..."`);

            const now = new Date();
            const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
            const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

            // ── Build System Prompt ─────────────────────────────────────
            let finalSystemPrompt = `${SYSTEM_PROMPT}\n\n## CURRENT REAL-WORLD CONTEXT\n- Current Date: ${dateStr}\n- Current Time: ${timeStr}\n\nYou MUST use this time context.`;

            if (isDeepResearch) {
                finalSystemPrompt += `\n\n${DEEP_RESEARCH_PROMPT}`;
                emit({ type: 'thinking', message: 'Initializing Deep Research protocol...' });
            } else {
                emit({ type: 'thinking', message: 'Analyzing your question...' });
            }

            if (context) {
                finalSystemPrompt += `\n\nRELEVANT CONTEXT FROM DOCUMENTS:\n${context}`;
            }

            const messages = [
                { role: 'system', content: finalSystemPrompt },
                ...conversationHistory,
                { role: 'user', content: message }
            ];

            // ── Tool Strategy ───────────────────────────────────────────
            let tools = [WEB_SEARCH_TOOL];
            if (isDeepResearch) {
                tools.push(BROWSER_EXTRACT_TOOL);
            }

            let toolChoice = 'auto';
            if (context) {
                tools = [];
                toolChoice = 'none';
                emit({ type: 'thinking', message: 'Searching your local knowledge...' });
            } else if (forceSearch) {
                toolChoice = { type: 'function', function: { name: 'web_search' } };
            }

            // ── Agentic Loop ────────────────────────────────────────────
            const searchSteps = [];
            const allSources = [];
            let iteration = 0;
            let lastAssistantMessage = null;
            let totalSearchCount = 0;
            const maxSteps = isDeepResearch ? 10 : MAX_AGENTIC_STEPS;

            while (iteration < maxSteps) {
                iteration++;
                log('🔄', `━━━ Step ${iteration}/${maxSteps} ━━━`);

                const callOptions = {
                    model: MODEL_NAME,
                    messages,
                    temperature: isDeepResearch ? 0.4 : 0.7, // Lower temperature for more focused research
                    tools: tools.length > 0 ? tools : undefined,
                    tool_choice: tools.length > 0 ? (iteration === 1 && forceSearch ? toolChoice : 'auto') : undefined
                };

                if (iteration > 1) {
                    const phaseMsg = isDeepResearch
                        ? `Research Phase ${iteration}/${maxSteps}: ${this.getDynamicResearchMessage(iteration)}`
                        : 'Analyzing results and deciding if more research is needed...';
                    emit({ type: 'thinking', message: phaseMsg });
                }

                let response;
                try {
                    response = await groq.chat.completions.create(callOptions);
                } catch (apiError) {
                    // (Error handling logic from previous implementation)
                    const status = apiError.status || apiError.response?.status;
                    const errorBody = apiError.error || apiError.body?.error || {};
                    const errorCode = errorBody.code || apiError.code;
                    const failedText = errorBody.failed_generation;

                    if (status === 400 && (errorCode === 'tool_use_failed' || apiError.message?.includes('tool_use_failed'))) {
                        let finalFailedText = failedText;
                        if (!finalFailedText && apiError.message?.includes('{')) {
                            try {
                                const start = apiError.message.indexOf('{');
                                const json = JSON.parse(apiError.message.substring(start));
                                finalFailedText = json.error?.failed_generation;
                            } catch (e) { /* ignore */ }
                        }
                        if (finalFailedText && finalFailedText.length > 20) {
                            lastAssistantMessage = { content: finalFailedText };
                            break;
                        }
                    }
                    if (totalSearchCount > 0) {
                        emit({ type: 'synthesizing', message: 'Recovering research data...' });
                        try {
                            const synthCall = await groq.chat.completions.create({ model: MODEL_NAME, messages, temperature: 0.7 });
                            lastAssistantMessage = synthCall.choices[0].message;
                            break;
                        } catch (e) { log('❌', 'Synthesis failed after error'); }
                    }
                    throw apiError;
                }

                const assistantMsg = response.choices[0].message;

                // If assistant tries to stop, but research is shallow...
                if (!assistantMsg.tool_calls || assistantMsg.tool_calls.length === 0) {
                    if (isDeepResearch && totalSearchCount < 4 && iteration < maxSteps) {
                        log('⚠️', `Research felt shallow (${totalSearchCount} searches). Forcing continuation...`);
                        emit({ type: 'thinking', message: 'Research seems shallow. Digging for more angles...' });

                        messages.push(assistantMsg);
                        messages.push({
                            role: 'user',
                            content: "The research so far is too shallow or repetitive. Please identify at least 3 NEW, distinct angles, technical details, or specific data points you haven't investigated yet. Broaden the search to completely new sources to ensure a truly comprehensive report."
                        });
                        continue; // Force another iteration
                    }

                    lastAssistantMessage = assistantMsg;
                    break;
                }

                messages.push(assistantMsg);

                // ── Process Tool Calls ──────────────────────────────────
                const toolResults = await Promise.all(assistantMsg.tool_calls.map(async (toolCall) => {
                    const functionName = toolCall.function.name;
                    let args;
                    try { args = JSON.parse(toolCall.function.arguments); } catch (e) {
                        return { role: 'tool', tool_call_id: toolCall.id, content: 'Invalid JSON arguments.' };
                    }

                    if (functionName === 'web_search') {
                        const { query, topic = 'general' } = args;
                        // Force high breadth and depth for Deep Research
                        const search_depth = isDeepResearch ? 'advanced' : (args.search_depth || 'basic');
                        const max_results = isDeepResearch ? 10 : (args.max_results || 5);

                        totalSearchCount++;
                        const step = {
                            id: `step-${iteration}-${totalSearchCount}`,
                            type: 'searching',
                            query, topic, depth: search_depth,
                            status: 'running', timestamp: Date.now()
                        };
                        searchSteps.push(step);
                        emit({ type: 'searching', step, message: `Searching: "${query}" (depth: ${search_depth})...` });

                        const searchResult = await tavilyService.search({
                            query,
                            topic,
                            max_results,
                            search_depth
                        });

                        step.status = searchResult.success ? 'done' : 'error';
                        step.resultCount = searchResult.success ? (searchResult.sources?.length ?? 0) : 0;
                        emit({ type: 'search_complete', step, message: `Found ${step.resultCount} results for "${query}"` });

                        if (searchResult.success && searchResult.sources) allSources.push(...searchResult.sources);
                        return { role: 'tool', tool_call_id: toolCall.id, content: searchResult.success ? searchResult.results : `Search failed: ${searchResult.error}` };
                    }

                    if (functionName === 'browser_extract') {
                        const { urls } = args;
                        const stepId = `extract-${iteration}-${Date.now()}`;
                        const step = {
                            id: stepId,
                            type: 'reading',
                            urls,
                            status: 'running', timestamp: Date.now()
                        };
                        searchSteps.push(step);
                        emit({ type: 'reading', step, message: `Deep-reading ${urls.length} full web pages...` });
                        log('📄', `Extracting: ${urls.join(', ')}`);

                        const extractResult = await tavilyService.extract(urls);
                        step.status = extractResult.success ? 'done' : 'error';
                        emit({ type: 'reading_complete', step, message: extractResult.success ? `Finished reading ${urls.length} pages` : 'Failed to read web pages' });

                        if (extractResult.success) {
                            const formatted = extractResult.results.map(r => `URL: ${r.url}\nCONTENT: ${r.raw_content || r.content}`).join('\n\n---\n\n');
                            return { role: 'tool', tool_call_id: toolCall.id, content: `Extracted Content:\n${formatted}` };
                        }
                        return { role: 'tool', tool_call_id: toolCall.id, content: `Extraction failed: ${extractResult.error}` };
                    }

                    return { role: 'tool', tool_call_id: toolCall.id, content: 'Unknown tool.' };
                }));

                for (const result of toolResults) messages.push(result);
                log('📊', `Step ${iteration}: processes ${toolResults.length} tool(s).`);
            }

            if (!lastAssistantMessage) {
                emit({ type: 'synthesizing', message: 'Synthesizing long-form research report...' });
                const finalCall = await groq.chat.completions.create({ model: MODEL_NAME, messages, temperature: 0.5 });
                lastAssistantMessage = finalCall.choices[0].message;
            } else if (totalSearchCount > 0) {
                emit({ type: 'synthesizing', message: isDeepResearch ? 'Finalizing structured report...' : 'Writing final answer...' });
            }

            const uniqueSources = this.deduplicateSources(allSources);
            emit({ type: 'complete', message: 'Research complete' });

            return {
                response: lastAssistantMessage.content,
                searchPerformed: totalSearchCount > 0,
                sources: uniqueSources,
                searchSteps,
                totalSteps: iteration,
                totalSearches: totalSearchCount
            };
        } catch (error) {
            emit({ type: 'error', message: error.message });
            return this.handleError(error);
        }
    }

    deduplicateSources(sources) {
        const seen = new Set();
        return sources.filter(s => {
            if (!s.url || seen.has(s.url)) return false;
            seen.add(s.url);
            return true;
        });
    }

    handleError(error) {
        const status = error.status || error.response?.status;
        let message = 'AI service temporarily unavailable.';
        let code = 'GROQ_ERROR';
        if (status === 429) { message = 'Rate limit exceeded.'; code = 'RATE_LIMIT'; }
        else if (status === 401 || status === 403) { message = 'Auth error.'; code = 'AUTH_ERROR'; }
        console.error(`❌ GroqService error: ${error.message}`);
        return { success: false, error: message, code };
    }

    getDynamicResearchMessage(iteration) {
        const messages = [
            'Diverging search angles to find hidden patterns...',
            'Cross-referencing sources for factual consistency...',
            'Identifying missing links in the investigation...',
            'Deepening analysis of key dimensions...',
            'Triangulating data from multiple domains...',
            'Expanding search to secondary leads...',
            'Validating findings against primary sources...',
            'Synthesizing complex relationships...',
            'Refining research based on discovered information...',
            'Exhausting all investigation paths...'
        ];
        return messages[(iteration - 2) % messages.length];
    }
}

module.exports = new GroqService();
