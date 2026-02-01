const assert = require('assert');
const path = require('path');

// Mock database
const mockQueryAll = (text, params) => {
    // Record the params for verification
    mockQueryAll.calls.push({ text, params });
    return Promise.resolve([]);
};
mockQueryAll.calls = [];

// Inject mock
const dbPath = path.resolve(__dirname, '../src/config/database.js');
require.cache[dbPath] = {
    id: dbPath,
    filename: dbPath,
    loaded: true,
    exports: {
        queryAll: mockQueryAll,
        queryOne: () => Promise.resolve(null),
        query: () => Promise.resolve(null)
    }
};

const SearchService = require('../src/services/SearchService');

async function testWildcardEscaping() {
    console.log('Testing SearchService wildcard escaping...');

    // Test case 1: Input "100%"
    console.log('Test 1: Input "100%"');
    mockQueryAll.calls = [];
    await SearchService.search('100%', { limit: 10 });

    if (mockQueryAll.calls.length === 0) {
        console.log('Skipped due to length check?');
    } else {
        let lastCall = mockQueryAll.calls[0];
        let pattern = lastCall.params[0];
        console.log('Pattern:', pattern);

        // We expect "100%" to be escaped to "100\%"
        // Wrapped in wildcards: "%100\%%"
        if (pattern === '%100%%') {
            console.error('❌ Failed: "%" was not escaped. Pattern:', pattern);
        } else if (pattern === '%100\\%%') {
            console.log('✅ Passed: "%" was escaped correctly to', pattern);
        } else {
             console.log('⚠️ Result:', pattern);
        }
    }

    // Test case 2: Input "a_b"
    console.log('\nTest 2: Input "a_b"');
    mockQueryAll.calls = [];
    await SearchService.search('a_b', { limit: 10 });

    if (mockQueryAll.calls.length > 0) {
        let lastCall = mockQueryAll.calls[0];
        let pattern = lastCall.params[0];
        console.log('Pattern:', pattern);

        if (pattern === '%a_b%') {
            console.error('❌ Failed: "_" was not escaped. Pattern:', pattern);
        } else if (pattern === '%a\\_b%') {
            console.log('✅ Passed: "_" was escaped correctly to', pattern);
        }
    } else {
        console.log('Skipped due to length check?');
    }

    // Test case 3: Input "a\b" (Backslash)
    console.log('\nTest 3: Input "a\\b"');
    mockQueryAll.calls = [];
    await SearchService.search('a\\b', { limit: 10 });

    if (mockQueryAll.calls.length > 0) {
        let lastCall = mockQueryAll.calls[0];
        let pattern = lastCall.params[0];
        console.log('Pattern:', pattern);

        // Input: a\b
        // Escaped: a\\b
        // Wrapped: %a\\b%
        if (pattern === '%a\\b%') {
             console.error('❌ Failed: "\\" was not escaped. Pattern:', pattern);
        } else if (pattern === '%a\\\\b%') {
             console.log('✅ Passed: "\\" was escaped correctly to', pattern);
        }
    }

    console.log('\nDone.');
}

testWildcardEscaping().catch(err => {
    console.error(err);
    process.exit(1);
});
