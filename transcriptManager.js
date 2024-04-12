const fs = require('fs').promises;
const path = require('path');

const BASE_DIR = path.join(__dirname, 'files');
const transcriptPath = path.join(BASE_DIR, 'transcripts', 'current transcript.txt');

function sanitizeInput(input) {
    return input.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function appendToTranscript(message, role) {
    try {
        const sanitizedMessage = sanitizeInput(message);
        const startTag = role === 'player' ? '<PC>' : '<GM>';
        const endTag = role === 'player' ? '</PC>' : '</GM>';

        // Use a unique separator for messages
        const messageWithTags = `${startTag}${sanitizedMessage}${endTag}|||`;
        await fs.appendFile(transcriptPath, messageWithTags);

        const updatedTranscript = await fs.readFile(transcriptPath, 'utf8');
        return updatedTranscript;
    } catch (error) {
        console.error("Error in appendToTranscript:", error);
        throw new Error('Failed to append to and fetch transcript');
    }
}

module.exports = {
    appendToTranscript
};
