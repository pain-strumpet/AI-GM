const { ipcMain } = require('electron');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

function setupPayloadAssembler(BASE_DIR, ROOT_DIR) {
    ipcMain.on('send-to-python', (event, fileContents) => {
        const messages = [];

        // Assuming fileContents is an array of [key, value] pairs
        fileContents.forEach(([key, value]) => {
            const [category, fileName] = key.split('-');
            let role;

            // Assign roles based on the category or file name
            if (category === 'instructions') {
                role = 'system';
                messages.push({ role: role, content: value });
            } else if (category === 'world') {
                role = 'user';
                messages.push({ role: role, content: value });
            } else if (category === 'transcripts') {
                // Split the transcript by the role tags
                const transcriptParts = value.split(/<\/?PC>|<\/?GM>/).filter(part => part.trim() !== '');
                // Loop through the parts and assign the roles
                for (let i = 0; i < transcriptParts.length; i++) {
                    const content = transcriptParts[i].trim();
                    if (content.length > 0) {
                        // Even indices correspond to the 'user' role; odd indices correspond to the 'assistant' role
                        role = i % 2 === 0 ? 'user' : 'assistant';
                        messages.push({ role: role, content: content });
                    }
                }
            }
        });

        const pythonScriptPath = path.join(ROOT_DIR, 'backend.py');
        console.log(`Attempting to spawn Python script at: ${pythonScriptPath}`);
        const pythonProcess = spawn('python', [pythonScriptPath], { stdio: ['pipe', 'pipe', 'pipe'] });
        console.log("Python script spawned, waiting for output...");
        
        console.log("Sending structured payload to Python backend:", JSON.stringify({ messages: messages }, null, 2));

        pythonProcess.stdout.on('data', (data) => {
            const rawData = data.toString();
            console.log(`Raw data from Python script: ${rawData}`);
        
            if (rawData.trim().startsWith('{')) { // Simple check for JSON data
                try {
                    const jsonResponse = JSON.parse(rawData);
                    if (jsonResponse && jsonResponse.response) {
                        // Emit an event on ipcMain that can be listened to by the main process
                        ipcMain.emit('response-received', null, { response: jsonResponse.response, context: 'chat' });
                    }
                } catch (parseErr) {
                    console.error("Error parsing Python script output:", parseErr);
                }
            } else {
                console.log("Received non-JSON data from Python script:", rawData);
            }
        });        

        pythonProcess.stderr.on('data', (data) => {
            console.error(`Python script error output: ${data}`);
        });

        pythonProcess.on('error', (error) => {
            console.error(`Failed to start Python script: ${error}`);
        });

        // Write the messages array to the Python process
        pythonProcess.stdin.write(JSON.stringify({ messages: messages }));
        pythonProcess.stdin.end();
    });
}

module.exports = { setupPayloadAssembler };
