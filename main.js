const { app, BrowserWindow, ipcMain } = require('electron');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const util = require('util');
const fsAppendFile = util.promisify(fs.appendFile);
const fsReadFile = util.promisify(fs.readFile);
const { setupPayloadAssembler } = require('./payloadAssembler');
const transcriptManager = require('./transcriptManager');
const { handleResponse } = require('./responseHandler');
const { setupResponseHandler } = require('./responseHandler');
const BASE_DIR = path.join(__dirname, 'files');
const ROOT_DIR = __dirname;
const directories = {
    'instructions': path.join(BASE_DIR, 'instructions'),
    'transcripts': path.join(BASE_DIR, 'transcripts'),
    'world': path.join(BASE_DIR, 'world')
};

function createWindow() {
    const mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            enableRemoteModule: false,
            nodeIntegration: false,
            sandbox: true,
            webSecurity: true,
        }
    });

    mainWindow.loadFile('index.html');
    // mainWindow.webContents.openDevTools(); // Uncomment for debugging
}

app.whenReady().then(() => {
    createWindow();
    setupPayloadAssembler(BASE_DIR, ROOT_DIR);
    setupResponseHandler();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'macOS') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

// IPC listener for listing files
ipcMain.on('list-files', (event, subdir) => {
    const dirPath = directories[subdir];
    fs.readdir(dirPath, { withFileTypes: true }, (err, dirents) => {
        if (err) {
            console.error(`Error reading directory ${subdir}: ${err}`);
            event.reply('files-list', { subdir, files: [] });
            return;
        }
        const fileList = dirents
            .filter(dirent => dirent.isFile())
            .map(dirent => dirent.name);
        event.reply('files-list', { subdir, files: fileList });
    });
});

// IPC listener for requesting file content
ipcMain.on('request-file-content', async (event, { category, fileName }) => {
    const filePath = path.join(BASE_DIR, category, fileName);
    console.log("Received request for file content:", filePath);
    try {
        const content = await fs.promises.readFile(filePath, 'utf8');
        console.log("Sending file content back to renderer:", filePath);
        event.reply('file-content-response', { category, fileName, content });
    } catch (error) {
        console.error(`Error reading file ${filePath}:`, error);
        event.reply('file-content-response', { category, fileName, content: null });
    }
});

// IPC Listener for sending file content to File Management UI
ipcMain.on('request-file-content-right-click', (event, { category, fileName }) => {
    const filePath = path.join(directories[category], fileName);
    fs.readFile(filePath, 'utf8', (err, content) => {
        if (err) {
            console.error(`Error reading file ${filePath}: ${err}`);
            return;
        }
        // Reply on a dedicated channel for displaying content
        event.reply('display-file-content-right-click', { fileName, content });
    });
});

ipcMain.on('response-channel', async (event, { response, context, additionalParams }) => {
    try {
        await handleResponse(response, context, additionalParams);
        // Notify the renderer process if needed
        event.reply('response-handled-successfully', { context });
    } catch (error) {
        console.error(`Error handling response for context ${context}:`, error);
        // Handle the error, potentially notifying the renderer process
    }
});

// IPC listener for appending to the transcript
ipcMain.handle('append-to-transcript', async (event, messageData) => {
    try {
        const { message, role } = JSON.parse(messageData);
        const updatedTranscript = await transcriptManager.appendToTranscript(message, role);
        return updatedTranscript;  // Send back the updated transcript content
    } catch (error) {
        console.error("Error handling append-to-transcript:", error);
        throw error;  // Rethrow or handle as needed
    }
});
