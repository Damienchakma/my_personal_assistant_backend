const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const xlsx = require('xlsx');

const log = (emoji, msg, ...args) => console.log(`[DOC_EXTRACT] ${emoji} ${msg}`, ...args);
const err = (msg, e) => console.error(`[DOC_EXTRACT] ❌ ${msg}`, e?.message || e);

class DocumentExtractionService {
    /**
     * Extract text from a file based on its MIME type / extension.
     */
    async extractText(file) {
        const mime = file.mimetype || '';
        const name = (file.originalname || '').toLowerCase();
        log('📝', `Extracting text | MIME: "${mime}" | File: "${file.originalname}" | Size: ${file.buffer?.length ?? 0} bytes`);

        // PDF
        if (mime === 'application/pdf' || name.endsWith('.pdf')) {
            log('📝', 'Parser: pdf-parse');
            const data = await pdfParse(file.buffer);
            log('📝', `pdf-parse result: ${data.numpages} pages, ${data.text.length} chars`);
            return data.text;
        }

        // Word (.docx / .doc)
        if (
            mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
            mime === 'application/msword' ||
            name.endsWith('.docx') || name.endsWith('.doc')
        ) {
            log('📝', 'Parser: mammoth (Word)');
            const result = await mammoth.extractRawText({ buffer: file.buffer });
            log('📝', `mammoth result: ${result.value.length} chars`);
            return result.value;
        }

        // Excel
        if (
            mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
            mime === 'application/vnd.ms-excel' ||
            name.endsWith('.xlsx') || name.endsWith('.xls')
        ) {
            log('📝', 'Parser: xlsx');
            const workbook = xlsx.read(file.buffer, { type: 'buffer' });
            const texts = workbook.SheetNames.map(sheetName => {
                const ws = workbook.Sheets[sheetName];
                return `=== Sheet: ${sheetName} ===\n` + xlsx.utils.sheet_to_csv(ws);
            });
            const combined = texts.join('\n\n');
            log('📝', `xlsx result: ${workbook.SheetNames.length} sheets, ${combined.length} chars`);
            return combined;
        }

        // CSV
        if (mime === 'text/csv' || name.endsWith('.csv')) {
            log('📝', 'Parser: UTF-8 (CSV)');
            const text = file.buffer.toString('utf-8');
            log('📝', `CSV result: ${text.length} chars`);
            return text;
        }

        // JSON
        if (mime === 'application/json' || name.endsWith('.json')) {
            log('📝', 'Parser: JSON.parse');
            try {
                const parsed = JSON.parse(file.buffer.toString('utf-8'));
                const text = JSON.stringify(parsed, null, 2);
                log('📝', `JSON result: ${text.length} chars`);
                return text;
            } catch {
                const text = file.buffer.toString('utf-8');
                log('⚠️', 'JSON.parse failed, returning raw text');
                return text;
            }
        }

        // HTML / HTM
        if (
            mime === 'text/html' || mime === 'application/xhtml+xml' ||
            name.endsWith('.html') || name.endsWith('.htm')
        ) {
            log('📝', 'Parser: HTML tag stripper');
            const text = file.buffer.toString('utf-8').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
            log('📝', `HTML strip result: ${text.length} chars`);
            return text;
        }

        // XML
        if (mime === 'application/xml' || mime === 'text/xml' || name.endsWith('.xml')) {
            log('📝', 'Parser: XML tag stripper');
            const text = file.buffer.toString('utf-8').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
            log('📝', `XML strip result: ${text.length} chars`);
            return text;
        }

        // Plain text / Markdown / RTF / log
        if (
            mime.startsWith('text/') ||
            name.endsWith('.txt') || name.endsWith('.md') ||
            name.endsWith('.rtf') || name.endsWith('.log')
        ) {
            log('📝', 'Parser: UTF-8 (plain text)');
            const text = file.buffer.toString('utf-8');
            log('📝', `Plain text result: ${text.length} chars`);
            return text;
        }

        // Unknown — try UTF-8 as last resort
        log('⚠️', `Unknown MIME type "${mime}" for "${file.originalname}". Attempting UTF-8 decode.`);
        return file.buffer.toString('utf-8');
    }

    /**
     * Process a document and extract its text.
     * @param {Object} file - Multer file object
     */
    async processDocument(file) {
        const startTime = Date.now();
        log('📂', `─── EXTRACT START ───────────────────────────────────────`);
        log('📂', `File: "${file.originalname}" | MIME: ${file.mimetype} | Size: ${file.size ?? file.buffer?.length} bytes`);

        try {
            // 1. Extract text
            const text = await this.extractText(file);

            if (!text || text.trim().length === 0) {
                const msg = 'Extracted text is empty. The file may be image-only or unreadable.';
                err(msg);
                return { success: false, error: msg };
            }

            const elapsed = Date.now() - startTime;
            log('✅', `Extraction complete: ${text.length} chars from "${file.originalname}" in ${elapsed}ms`);
            log('📂', `─── EXTRACT END ─────────────────────────────────────────`);

            return { success: true, text: text };

        } catch (error) {
            const elapsed = Date.now() - startTime;
            err(`Extraction FAILED after ${elapsed}ms:`, error);
            log('📂', `─── EXTRACT END (FAILED) ────────────────────────────────`);
            return { success: false, error: error.message };
        }
    }
}

module.exports = new DocumentExtractionService();
