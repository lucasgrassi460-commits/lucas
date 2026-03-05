const fs = require('fs');
const path = require('path');
let pdfParse = null;
try {
    pdfParse = require('pdf-parse');
} catch (e) {
    console.warn("pdf-parse not installed, PDF reading will return empty text.");
}

async function extractTextFromDocument(document) {
    const filePath = path.join(__dirname, '../../uploads', document.filename);
    if (!fs.existsSync(filePath)) return '';

    if (document.type === 'application/pdf' || document.filename.endsWith('.pdf')) {
        if (!pdfParse) return '';
        try {
            const dataBuffer = fs.readFileSync(filePath);
            const data = await pdfParse(dataBuffer);
            return data.text;
        } catch (e) {
            console.error("Error reading PDF:", e);
            return '';
        }
    } else {
        // Assume text file
        try {
            return fs.readFileSync(filePath, 'utf8');
        } catch (e) {
            console.error("Error reading txt:", e);
            return '';
        }
    }
}

async function searchInDocuments(documents, query) {
    const normalizedQuery = query.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const keywords = normalizedQuery.split(' ').filter(k => k.length > 3); // basic keywords

    let bestMatch = null;
    let maxMatches = 0;

    for (const doc of documents) {
        const text = await extractTextFromDocument(doc);
        if (!text) continue;

        const normalizedText = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const paragraphs = normalizedText.split('\n\n').filter(p => p.trim().length > 0);
        const originalParagraphs = text.split('\n\n').filter(p => p.trim().length > 0);

        for (let i = 0; i < paragraphs.length; i++) {
            const p = paragraphs[i];

            // If the whole query is found as a phrase
            if (p.includes(normalizedQuery)) {
                return originalParagraphs[i].trim();
            }

            // Keyword match counting
            let matches = 0;
            for (const keyword of keywords) {
                if (p.includes(keyword)) matches++;
            }

            if (matches > 0 && matches > maxMatches) {
                maxMatches = matches;
                bestMatch = originalParagraphs[i].trim();
            }
        }
    }

    // Require at least some threshold if not an exact phrase match
    return maxMatches >= Math.min(2, keywords.length) ? bestMatch : null;
}

module.exports = {
    searchInDocuments
};
