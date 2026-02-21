/**
 * Test Script: Agentic Web Search
 * Tests the multi-step agentic search loop with a complex query
 * that should trigger multiple search iterations.
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const groqService = require('../services/groqService');

async function main() {
    console.log('🧪 ═══════════════════════════════════════════════════════');
    console.log('🧪  AGENTIC SEARCH TEST');
    console.log('🧪 ═══════════════════════════════════════════════════════');
    console.log();

    // Test 1: Simple query (should trigger 1 search)
    console.log('━━━ TEST 1: Simple query ━━━');
    try {
        const result1 = await groqService.chat('What is the current price of Bitcoin?', [], true);
        console.log(`\n📊 Result:`);
        console.log(`   Response length: ${result1.response?.length ?? 0} chars`);
        console.log(`   Searches performed: ${result1.totalSearches}`);
        console.log(`   Total steps: ${result1.totalSteps}`);
        console.log(`   Sources: ${result1.sources?.length ?? 0}`);
        console.log(`   Search steps:`);
        (result1.searchSteps || []).forEach((step, i) => {
            console.log(`     ${i + 1}. [${step.status}] ${step.type}: "${step.query}" (${step.resultCount ?? 0} results)`);
        });
        console.log(`   Response preview: "${result1.response?.substring(0, 200)}..."`);
    } catch (err) {
        console.error('❌ Test 1 failed:', err.message);
    }

    console.log('\n');

    // Test 2: Complex multi-part query (should trigger multiple searches)
    console.log('━━━ TEST 2: Complex multi-part query ━━━');
    try {
        const result2 = await groqService.chat(
            'Compare the latest features of React 19 vs Vue 4. Which one has better performance benchmarks in 2026?',
            [],
            true
        );
        console.log(`\n📊 Result:`);
        console.log(`   Response length: ${result2.response?.length ?? 0} chars`);
        console.log(`   Searches performed: ${result2.totalSearches}`);
        console.log(`   Total steps: ${result2.totalSteps}`);
        console.log(`   Sources: ${result2.sources?.length ?? 0}`);
        console.log(`   Search steps:`);
        (result2.searchSteps || []).forEach((step, i) => {
            console.log(`     ${i + 1}. [${step.status}] ${step.type}: "${step.query}" (${step.resultCount ?? 0} results)`);
        });
        console.log(`   Response preview: "${result2.response?.substring(0, 200)}..."`);
    } catch (err) {
        console.error('❌ Test 2 failed:', err.message);
    }

    console.log('\n');

    // Test 3: Non-search query (should NOT trigger any search)
    console.log('━━━ TEST 3: Non-search query ━━━');
    try {
        const result3 = await groqService.chat('What is 2 + 2?', []);
        console.log(`\n📊 Result:`);
        console.log(`   Response length: ${result3.response?.length ?? 0} chars`);
        console.log(`   Searches performed: ${result3.totalSearches}`);
        console.log(`   Search steps: ${result3.searchSteps?.length ?? 0}`);
        console.log(`   Response: "${result3.response?.substring(0, 200)}"`);
    } catch (err) {
        console.error('❌ Test 3 failed:', err.message);
    }

    console.log('\n🧪 ═══════════════════════════════════════════════════════');
    console.log('🧪  ALL TESTS COMPLETE');
    console.log('🧪 ═══════════════════════════════════════════════════════');
}

main();
