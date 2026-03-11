const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');

async function searchInDocuments(docs, query) {
    let context = '';
    
    // For now, we will just read the full content of small files or first few pages of PDF
    // In a production system, this should be RAG (Embeddings + Vector DB)
    
    for (const doc of docs) {
        try {
            const filePath = path.join(__dirname, '../../uploads', doc.filename);
            if (!fs.existsSync(filePath)) continue;

            let content = '';
            if (doc.type === 'application/pdf' || doc.filename.endsWith('.pdf')) {
                const buffer = fs.readFileSync(filePath);
                const data = await pdfParse(buffer);
                content = data.text;
            } else {
                content = fs.readFileSync(filePath, 'utf8');
            }

            // Simple "search": check if keywords exist, or just append content if it's small enough
            // To be robust without vector search, we will just truncate content to avoid token limits
            // and provide it as context.
            
            // Limit per document to avoid huge context
            const limit = 2000; 
            const snippet = content.substring(0, limit); 
            context += `\n--- Document: ${doc.original_name} ---\n${snippet}\n`;
            
        } catch (e) {
            console.error(`Error reading doc ${doc.original_name}:`, e);
        }
    }
    
    return context;
}

module.exports = { searchInDocuments };
