const { ipcMain } = require('electron'); // Import ipcMain to set up the listener
const transcriptManager = require('./transcriptManager');
const { BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

const BASE_DIR = path.join(__dirname, 'files');

function setupResponseHandler() {
    // Listen for 'response-received' events emitted from anywhere in the main process
    ipcMain.on('response-received', async (event, { response, context, additionalParams = {} }) => {
        switch (context) {
            case 'chat':
                await transcriptManager.appendToTranscript(response, 'GM');
                console.log('Sending transcript-updated message to renderer process');
                BrowserWindow.getAllWindows()[0].webContents.send('transcript-updated');                break;
            case 'summary':
                await appendSummaryToSpecificFile(response, additionalParams);
                break;
            // Additional cases as needed
        }
    });
}

async function appendSummaryToSpecificFile(response, { summaryFilePath }) {
    const fullPath = path.join(BASE_DIR, summaryFilePath);
    const formattedResponse = formatResponseForSummary(response);
    await fs.promises.appendFile(fullPath, formattedResponse + '\n');
}

function formatResponseForSummary(response) {
    // Format the response as needed for summaries
    return response; // Placeholder - replace with actual formatting logic
}

// Export the setup function so it can be called from the main process initialization code
module.exports = { setupResponseHandler };
