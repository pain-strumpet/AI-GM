document.addEventListener('DOMContentLoaded', () => {
    // --- Toggle Interface Code Block ---
    const toggleButton = document.getElementById('toggle-button');
    const fileManagementInterface = document.getElementById('file-management-interface');
    const chatInterface = document.getElementById('chat-interface');

    function toggleInterfaces() {
        const isChatVisible = chatInterface.style.display !== 'none';
    
        // Call storeFileManagementState before toggling away from the file management interface
        if (!isChatVisible) {
            storeFileManagementState();
            loadAndDisplayTranscript();
        }
    
        chatInterface.style.display = isChatVisible ? 'none' : 'block';
        fileManagementInterface.style.display = isChatVisible ? 'flex' : 'none';
    
        // When switching to the file management interface
        if (fileManagementInterface.style.display !== 'none') {
            // Refresh the file list for each subdirectory
            subdirectories.forEach(subdir => {
                requestFileList(subdir);
            });
        }
    }
    
    // Toggle the interfaces when the button is clicked
    toggleButton.addEventListener('click', () => {
        toggleInterfaces();
    });
    
    // --- File Listing Request Code Block ---
    function requestFileList(subdir) {
        window.api.send('list-files', subdir);
    }
    
    // --- File Listing Display Code Block ---
    window.api.receive('files-list', ({ subdir, files }) => {
        const listing = document.getElementById(`${subdir}-listing`);
        listing.innerHTML = ''; 

        // First, add files from the saved state in their saved order
        savedFileStates[subdir].forEach(savedFile => {
            if (files.includes(savedFile.fileName)) { // Only add if the file still exists
                const fileItem = createFileItem(subdir, savedFile.fileName, savedFile.isChecked);
                listing.appendChild(fileItem);
                files = files.filter(f => f !== savedFile.fileName); // Remove added file from the list of new files
            }
        });

        // Then, append any new files that weren't in the saved state
        files.forEach(file => {
            const fileItem = createFileItem(subdir, file, false); // New files are unchecked by default
            listing.appendChild(fileItem);
        });
    });

    function createFileItem(subdir, fileName, isChecked) {
        const fileItem = document.createElement('div');
        fileItem.classList.add('file-item');
        fileItem.setAttribute('draggable', 'true');
    
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `${subdir}-${fileName}`;
        checkbox.checked = isChecked;
        checkbox.classList.add('file-checkbox');
    
        const label = document.createElement('label');
        label.htmlFor = `${subdir}-${fileName}`;
        label.textContent = fileName;
        label.classList.add('file-label');
    
        // Display file content on right-click
        fileItem.addEventListener('contextmenu', (event) => {
            event.preventDefault(); // Prevent default context menu
            window.api.send('request-file-content-right-click', { category: subdir, fileName }); // Use the new channel
        });

        fileItem.appendChild(checkbox);
        fileItem.appendChild(label);
    
        return fileItem;
    }    

    const subdirectories = ['instructions', 'transcripts', 'world'];
    subdirectories.forEach(requestFileList);

    window.api.receive('display-file-content-right-click', ({ fileName, content }) => {
        const fileContentPane = document.getElementById('file-display-pane');
        // Update to display content. Adjust the formatting as needed.
        fileContentPane.innerHTML = `<h2>File Content: ${fileName.replace('.txt', '')}</h2><pre class="pre-wrap">${content}</pre>`;

    });
    
    // --- Drag and Drop Code Block ---
    function enableDragAndDrop(listingId) {
        const listing = document.getElementById(listingId);
        let draggedItem = null;

        listing.addEventListener('dragstart', event => {
            draggedItem = event.target.closest('.file-item');
            event.dataTransfer.effectAllowed = 'move';
        });

        listing.addEventListener('dragover', event => {
            event.preventDefault();
            const targetItem = event.target.closest('.file-item');
            if (targetItem && draggedItem) {
                const rect = targetItem.getBoundingClientRect();
                const halfway = rect.top + rect.height / 2;
                const afterTarget = event.clientY > halfway;
                listing.insertBefore(draggedItem, afterTarget ? targetItem.nextSibling : targetItem);
            }
        });

        listing.addEventListener('dragend', () => {
            draggedItem = null;
        });
    }

    subdirectories.forEach(subdir => enableDragAndDrop(`${subdir}-listing`));

    // State Management Code Block: the retention
    let savedFileStates = {
        'instructions': [],
        'transcripts': [],
        'world': []
    };
    
    function storeFileManagementState() {
        subdirectories.forEach(subdir => {
            const listing = document.getElementById(`${subdir}-listing`);
            const files = listing.querySelectorAll('.file-item');
            savedFileStates[subdir] = Array.from(files).map(fileItem => {
                const fileName = fileItem.querySelector('label').textContent;
                const isChecked = fileItem.querySelector('input[type="checkbox"]').checked;
                return { fileName, isChecked };
            });
        });
    }
    
    // Gather File Contents for the Payload Assembler and the Backend API Call
    let pendingFileContents = new Map();

    window.api.receive('file-content-response', ({ category, fileName, content }) => {
        if (category === 'transcripts' && fileName === 'current transcript.txt') {
            if (typeof content === 'string') {
                const chatDisplay = document.getElementById('chat-display');
                chatDisplay.innerHTML = ''; // Clear existing content
    
                // Split the content by the message separator
                const messages = content.split('|||');
    
                messages.forEach(message => {
                    if (!message.trim()) return; // Skip empty messages
    
                    const messageDiv = document.createElement('div');
                    if (message.includes('<PC>')) {
                        messageDiv.classList.add('pc');
                        messageDiv.innerHTML = message.replace('<PC>', '').replace('</PC>', '').replace(/\n/g, '<br>');
                    } else if (message.includes('<GM>')) {
                        messageDiv.classList.add('gm');
                        messageDiv.innerHTML = message.replace('<GM>', '').replace('</GM>', '').replace(/\n/g, '<br>');
                    }
                    chatDisplay.appendChild(messageDiv);
                });
    
                chatDisplay.scrollTop = chatDisplay.scrollHeight; // Scroll to the bottom of the chat display
            } else {
                console.error('Transcript content is not a string:', content);
            }
        }
    
        // Check if this is the last expected file content response
        const key = `${category}-${fileName}`;
        if (pendingFileContents.has(key)) {
            pendingFileContents.set(key, content);
    
            // Check if all requests have been fulfilled
            const allContentsReceived = Array.from(pendingFileContents.values()).every(content => content !== null);
    
            if (allContentsReceived) {
                console.log("Sending payload to main process:", JSON.stringify([...pendingFileContents]));
                window.api.send('send-to-python', [...pendingFileContents]);
    
                // Reset pendingFileContents for the next operation
                pendingFileContents.clear();
            }
        }
    });
    
    function gatherAndSendFileContents() {
        console.log("gatherAndSendFileContents function called");
    
        pendingFileContents = new Map();
    
        Object.keys(savedFileStates).forEach(category => {
            savedFileStates[category].forEach(fileState => {
                if (fileState.isChecked) {
                    const key = `${category}-${fileState.fileName}`;
                    pendingFileContents.set(key, null);
                    console.log("Requesting file content for:", key);
                    window.api.send('request-file-content', { category, fileName: fileState.fileName });
                }
            });
        });
    }

    // Chat Interface Send Functionality
    const sendButton = document.getElementById('send-button');
    const chatInput = document.getElementById('chat-input');
    const chatDisplay = document.getElementById('chat-display');

    // Update the event listener for the send button to use the new function
    sendButton.addEventListener('click', () => {
        const message = chatInput.value.trim();
        if (message) {
            // Use the async function to append the message and then clear the input field
            appendToTranscriptAndFetch(message, 'player').then(() => {
                chatInput.value = ''; // Clear the input field
            });
        }
    });

    async function appendToTranscriptAndFetch(message, role) {
        try {
            // Await the completion of the transcript update without storing the result
            await window.api.invoke('append-to-transcript', JSON.stringify({ message, role }));
            loadAndDisplayTranscript();
    
            // console log the message and role
            console.log("Message and role:", message, role);
    
            // Gathering and sending file contents for checked files
            gatherAndSendFileContents();
        } catch (error) {
            console.error('Failed to append to transcript and fetch:', error);
            // Handle the error appropriately
        }
    }
    
    async function loadAndDisplayTranscript() {
        try {
            console.log('Loading and displaying transcript');
            window.api.send('request-file-content', { category: 'transcripts', fileName: 'current transcript.txt' });
        } catch (error) {
            console.error('Error requesting transcript content:', error);
        }
    }

    window.api.receive('transcript-updated', () => {
        console.log('Received transcript-updated message');
        loadAndDisplayTranscript();
    });

});
