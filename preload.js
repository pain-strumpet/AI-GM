const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld(
    'api', {
        send: (channel, data) => {
            // Whitelist channels to send messages from renderer to main process
            const validSendChannels = ['list-files', 'request-file-content', 'request-file-content-right-click', 'send-to-python', 'response-channel', 'transcript-updated'];
            if (validSendChannels.includes(channel)) {
                ipcRenderer.send(channel, data);
            }
        },
        invoke: (channel, data) => {
            // If you have any channels that should use ipcRenderer.invoke, list them here and implement accordingly
            const validInvokeChannels = ['append-to-transcript']; // Example, adjust based on actual needs
            if (validInvokeChannels.includes(channel)) {
                return ipcRenderer.invoke(channel, data);
            }
        },
        receive: (channel, func) => {
            // Whitelist channels to receive messages in renderer from main process
            const validReceiveChannels = ['files-list', 'file-content-response', 'display-file-content-right-click', 'response-handled-successfully', 'transcript-updated'];
            if (validReceiveChannels.includes(channel)) {
                // Remove existing event listener if any, to prevent duplicate handlers
                ipcRenderer.removeAllListeners(channel);
                ipcRenderer.on(channel, (event, ...args) => func(...args));
            }
        }
    }
);
