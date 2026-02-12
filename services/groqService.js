/**
 * Groq AI Orchestrator Service
 * Implements agentic chat with web search tool calling.
 */

const Groq = require('groq-sdk');
const tavilyService = require('./tavilyService');

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
});

// Use Llama 4 Scout for proper tool calling support
const MODEL_NAME = 'meta-llama/llama-4-scout-17b-16e-instruct';

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

## MATH FORMATTING (CRITICAL)
- **DO NOT USE LaTeX** or '$' delimiters for math. The user interface CANNOT render them.
- **BAD**: $\\sqrt{x^2 + y^2}$, $\\frac{1}{2}$
- **GOOD**: sqrt(x^2 + y^2), 1/2, pi, theta
- Use code blocks for complex equations if needed.

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

## WHEN TO SEARCH
- Current events, news, recent developments
- Real-time data (weather, prices, scores, crypto)
- Questions about people, companies, products you're unsure about
- Anything that may have changed after your knowledge cutoff
- Facts that benefit from verification
- Facts that benefit from verification

## RESPONSE FORMAT WITH SEARCH RESULTS
When you receive search results, synthesize them into a comprehensive response:

1. **Opening**: Start with a clear, direct answer or definition
2. **Deep Dive**: Provide detailed explanation with multiple key points
3. **Context**: Add background, history, or related concepts
4. **Practical Info**: Include use cases, applications, or examples
5. **Current Status**: Mention recent developments if relevant

Example for "What is Ollama?":
Instead of: "Ollama is a tool for running LLMs [1]"
Write: "**Ollama** is a powerful open-source tool that allows you to run large language models locally on your computer. It provides a streamlined way to download, set up, and interact with various AI models like Llama, Mistral, and others without requiring complex configuration..."

Be engaging, informative, and thorough. Users want to learn, not just get quick facts.

## FLOWCHART & DIAGRAM FORMATTING (IMPORTANT)
When the user asks for a roadmap, step-by-step process, workflow, algorithm, or any concept that benefits from a visual diagram, **include a Mermaid diagram** in your response using a fenced code block with the language set to "mermaid".

**WHEN TO USE DIAGRAMS:**
- Learning roadmaps (e.g., "roadmap to learn Python")
- Step-by-step processes (e.g., "steps to deploy an app")
- Algorithms and CS flowcharts (e.g., "binary search flowchart")
- Decision trees or if/else logic
- System architecture overviews
- Any workflow or process the user asks about

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
- Use descriptive edge labels with ${'`'}-->|label|${'`'} syntax
- Do NOT use special characters like parentheses inside node labels without quoting them
- You can include multiple diagrams in a single response if needed`;


const WEB_SEARCH_TOOL = {
    type: 'function',
    function: {
        name: 'web_search',
        description: "Search the web using Tavily for current information, recent events, facts, real-time data, or verification. Use this when the user asks about something beyond your knowledge cutoff (January 2025) or when you need to verify current information.",
        parameters: {
            type: 'object',
            properties: {
                query: {
                    type: 'string',
                    description: "Concise search query extracted from user's question. Keep it short and focused on key terms only."
                },
                topic: {
                    type: 'string',
                    enum: ['general', 'news'],
                    description: "Type of search: 'general' for facts/information, 'news' for recent news/events"
                }
            },
            required: ['query']
        }
    }
};

/**
 * Groq AI Orchestrator Class
 */
class GroqService {
    /**
     * Processes a chat message with optional tool calling for web search.
     * @param {string} message - The user's message
     * @param {Array} conversationHistory - Conversation history
     * @param {boolean} forceSearch - Whether to force a web search
     * @param {string} context - Additional RAG context to inject into the system prompt
     * @returns {Promise<Object>} - The AI response
     */
    async chat(message, conversationHistory = [], forceSearch = false, context = '') {
        try {
            // Construct the system prompt
            let finalSystemPrompt = SYSTEM_PROMPT; // Use the global SYSTEM_PROMPT constant

            // Inject RAG context if available
            if (context) {
                console.log(`📥 Injecting ${context.length} characters of context into system prompt.`);
                finalSystemPrompt += `\n\nRELEVANT CONTEXT FROM DOCUMENTS:\n${context}\n\nINSTRUCTIONS:\nUse the above context to answer the user's question. If the answer is in the context, use it. If not, say you don't know based on the document. Do NOT say you cannot read documents, because the content has been provided to you as text above.`;
            } else {
                console.log('ℹ️ No context provided for this query.');
            }

            const messages = [
                { role: 'system', content: finalSystemPrompt },
                ...conversationHistory,
                { role: 'user', content: message }
            ];

            // Determine tool strategy
            // If context is provided (RAG), disable tools to force using the context
            // If forceSearch is true, we force the model to use the web_search function
            let tools = [WEB_SEARCH_TOOL];
            let toolChoice = 'auto';

            if (context) {
                tools = [];
                toolChoice = 'none';
            } else if (forceSearch) {
                toolChoice = { type: 'function', function: { name: 'web_search' } };
            }

            // Step 1: Initial call to Groq
            const initialResponse = await groq.chat.completions.create({
                model: MODEL_NAME,
                messages,
                tools: tools.length > 0 ? tools : undefined,
                tool_choice: toolChoice,
                temperature: 0.7
            });

            const assistantMessage = initialResponse.choices[0].message;

            // Step 2: Check if the model wants to use a tool
            if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
                const toolCall = assistantMessage.tool_calls[0];
                const functionName = toolCall.function.name;
                const functionArgs = JSON.parse(toolCall.function.arguments);

                if (functionName === 'web_search') {
                    const { query, topic = 'general' } = functionArgs;

                    // Execute the search
                    const searchResult = await tavilyService.search({ query, topic, max_results: 5 });

                    if (!searchResult.success) {
                        // Return a graceful error response
                        return {
                            response: `I tried to search for "${query}" but encountered an issue: ${searchResult.error}`,
                            searchPerformed: true,
                            searchQuery: query,
                            searchTopic: topic,
                            searchError: searchResult.error
                        };
                    }

                    // Prepare the tool response message
                    const toolResultContent = searchResult.answer
                        ? `Answer: ${searchResult.answer}\n\nSearch Results:\n${searchResult.results}`
                        : `Search Results:\n${searchResult.results}`;

                    // Append assistant's tool call and the tool result to the conversation
                    messages.push(assistantMessage);
                    messages.push({
                        role: 'tool',
                        tool_call_id: toolCall.id,
                        content: toolResultContent
                    });

                    // Step 3: Second call to generate final response with search context
                    const finalResponse = await groq.chat.completions.create({
                        model: MODEL_NAME,
                        messages,
                        temperature: 0.7
                    });

                    return {
                        response: finalResponse.choices[0].message.content,
                        searchPerformed: true,
                        searchQuery: query,
                        searchTopic: topic,
                        sources: searchResult.sources || []
                    };
                }
            }

            // No tool call, return direct response
            return {
                response: assistantMessage.content,
                searchPerformed: false,
                searchQuery: null,
                searchTopic: null,
                sources: []
            };

        } catch (error) {
            return this.handleError(error);
        }
    }

    /**
     * Handles errors from the Groq API.
     * @param {Error} error - The error object.
     * @returns {object} - Structured error object.
     */
    handleError(error) {
        const status = error.status || error.response?.status;
        let message = 'AI service temporarily unavailable.';
        let code = 'GROQ_ERROR';

        if (status === 429) {
            message = 'Too many requests. Please wait a moment.';
            code = 'RATE_LIMIT';
        } else if (status === 401 || status === 403) {
            message = 'AI service configuration error.';
            code = 'AUTH_ERROR';
        }

        console.error(`❌ Error in GroqService.chat: ${error.message}`);
        return { success: false, error: message, code };
    }
}

module.exports = new GroqService();
