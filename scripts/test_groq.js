const Groq = require('groq-sdk');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function main() {
    console.log('🧪 Testing Groq API...');
    try {
        const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
        const completion = await groq.chat.completions.create({
            messages: [{ role: 'user', content: 'Hello' }],
            model: 'llama-3.1-8b-instant',
        });
        console.log(`✅ Groq Success! Response: ${completion.choices[0].message.content}`);
    } catch (error) {
        console.error(`❌ Groq Failed: ${error.message}`);
    }
}

main();
