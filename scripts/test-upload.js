/**
 * Test Document Upload
 * Run with: node scripts/test-upload.js
 */
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

async function test() {
    console.log('Testing Document Upload...');

    try {
        const form = new FormData();
        const filePath = path.join(__dirname, '../dummy.txt');

        if (!fs.existsSync(filePath)) {
            console.error('❌ dummy.txt not found. Please create it first.');
            return;
        }

        form.append('file', fs.createReadStream(filePath));

        const response = await axios.post('http://localhost:3000/api/documents/upload', form, {
            headers: {
                ...form.getHeaders()
            }
        });

        console.log('✅ Upload Success:', response.data);
    } catch (error) {
        console.error('❌ Upload Failed:', error.response ? error.response.data : error.message);
    }
}

test();
