// frontend/src/chat.js
import './styles.css';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { initMFA } from './mfa';

// Pre-compile marked options
marked.setOptions({
    breaks: true,
    gfm: true,
    headerIds: false,
    mangle: false
});

// Initialize DOMPurify
const purify = DOMPurify(window);

// Configure DOMPurify options
const purifyOptions = {
    ALLOWED_TAGS: [
        'p', 'br', 'b', 'i', 'em', 'strong', 'a', 'ul', 'ol', 'li',
        'code', 'pre', 'h1', 'h2', 'h3', 'blockquote', 'span'
    ],
    ALLOWED_ATTR: ['href', 'target', 'rel', 'class']
};

// Make marked and DOMPurify available globally for mobile-nav.js
window.marked = marked;
window.DOMPurify = purify;
window.purifyOptions = purifyOptions;

// Store event source in window object for cross-file access
window.currentEventSource = null;
window.currentAssistantMessage = null;

// Create a main function that will be called on load
function initChat() {
    // Function to cleanup stream connection
    function cleanupStream() {
        if (currentEventSource) {
            console.log('Cleaning up stream connection');
            currentEventSource.close();
            currentEventSource = null;
        }
        if (currentAssistantMessage) {
            currentAssistantMessage = null;
        }
    }

    // Check if we're on a chat page by looking for essential elements
    const chatContainer = document.querySelector('.chat-container');
    const messageForm = document.getElementById('chat-form');
    
    // Only initialize chat functionality if we're on a chat page
    if (!chatContainer || !messageForm) {
        console.log('Not on chat page, skipping chat initialization');
        return; // Exit if we're not on a chat page
    }

    const messageInput = document.getElementById('message-input');
    const clearButton = document.getElementById('clear-btn');
    const stopButton = document.getElementById('stop-btn');
    const newChatButton = document.getElementById('new-chat-btn');
    const tempChatToggle = document.getElementById('temp-chat-toggle');
    
    // Add hamburger menu functionality
    const menuButton = document.querySelector('.menu-button');
    const sidebar = document.querySelector('.sidebar');
    
    if (menuButton && sidebar) {
        menuButton.addEventListener('click', () => {
            sidebar.classList.toggle('active');
        });
    }
    
    let currentEventSource = null;
    let currentAssistantMessage = null;
    let isTemporaryChat = false;

    function appendMessage(role, content) {
        console.log(`Appending message - Role: ${role}, Content length: ${content.length}`);
        
        const roleDiv = document.createElement('div');
        roleDiv.className = `message-role ${role.toLowerCase()}`;
        roleDiv.textContent = role;

        const messageDiv = document.createElement('div');
        messageDiv.className = `${role.toLowerCase()}-message`;
        
        if (role === 'Assistant') {
            // Sanitize and render markdown for assistant messages
            const parsedMarkdown = marked.parse(content);
            console.log('Parsed markdown length:', parsedMarkdown.length);
            
            const cleanHtml = purify.sanitize(parsedMarkdown, purifyOptions);
            console.log('Sanitized HTML length:', cleanHtml.length);
            
            messageDiv.innerHTML = cleanHtml;
        } else {
            messageDiv.textContent = content;
        }

        chatContainer.appendChild(roleDiv);
        chatContainer.appendChild(messageDiv);
        return messageDiv;
    }

    // Shared reset chat function
    async function resetChat() {
        // Clean up any existing stream connection
        if (currentEventSource) {
            currentEventSource.close();
            currentEventSource = null;
        }
        
        try {
            // Show loading indicator to provide visual feedback
            chatContainer.innerHTML = '<div class="loading-indicator">Creating new conversation...</div>';
            
            const response = await fetch('/reset', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    wasTemporary: isTemporaryChat
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.success) {
                // Clear chat container completely
                chatContainer.innerHTML = '';
                currentAssistantMessage = null;
                window.currentConversationId = data.new_conversation_id;
                
                // Only reload conversation history for non-temporary chats
                // Add a small delay to ensure backend processing completes
                if (!isTemporaryChat) {
                    setTimeout(() => {
                        loadConversationHistory();
                    }, 300);
                }
            }
        } catch (error) {
            console.error('Error resetting chat:', error);
            appendMessage('System', 'Failed to reset chat. Please try again.');
        }
    }

    // Handle Enter key press
    messageInput.addEventListener('keydown', function(event) {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            document.getElementById('send-btn').click();
        }
    });
    
    // Simplified stop button handler
    stopButton.addEventListener('click', function() {
        if (currentEventSource) {
            currentEventSource.close();
            currentEventSource = null;
            stopButton.disabled = true;
        }
    });
    
    // Use shared resetChat function for both buttons
    clearButton.addEventListener('click', resetChat);
    newChatButton.addEventListener('click', resetChat);
    
    // Temporary chat toggle
    tempChatToggle.addEventListener('change', function() {
        isTemporaryChat = this.checked;
        
        // Clear conversation history display if switching to temporary mode
        if (isTemporaryChat) {
            chatContainer.innerHTML = '';
        } else {
            // Load conversation history when switching back to permanent mode
            loadConversationHistory();
        }
    });

    messageForm.addEventListener('submit', async function(event) {
        event.preventDefault();
        const message = messageInput.value.trim();
        
        if (!message) return;

        try {
            // Disable the send button and input field while processing
            const sendButton = document.getElementById('send-btn');
            sendButton.disabled = true;
            messageInput.disabled = true;
            
            // Clear the input field immediately for better UX
            messageInput.value = '';
            
            // Clean up any existing stream connection
            cleanupStream();
            
            console.log('Sending chat message:', message);
            const response = await fetch('/api/chat/message', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    message,
                    isTemporary: isTemporaryChat 
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            console.log('Received response:', data);
            
            // Add the user message to the chat AFTER successful API response
            // This prevents duplicate messages if the conversation is loaded later
            appendMessage('User', message);
            
            // Get the conversation ID from the response
            const conversationId = data.conversationId;
            console.log('Using conversation ID for streaming:', conversationId);
            
            // Setup streaming response
            stopButton.disabled = false;
            let accumulatedResponse = '';
            
            // Create placeholder for assistant response
            currentAssistantMessage = appendMessage('Assistant', '');
            
            // Start streaming connection
            const streamUrl = `/api/chat/stream?conversationId=${conversationId}`;
            console.log('Connecting to stream URL:', streamUrl);
            currentEventSource = new EventSource(streamUrl);

            // Add event handlers for the EventSource
            currentEventSource.onopen = (event) => {
                console.log('EventSource connection opened:', event);
            };
            
            currentEventSource.onerror = (event) => {
                console.error('EventSource error:', event);
                if (event.target.readyState === EventSource.CLOSED) {
                    console.log('EventSource connection closed');
                    // Re-enable input when connection closes due to error
                    sendButton.disabled = false;
                    messageInput.disabled = false;
                    stopButton.disabled = true;
                }
            };
            
            currentEventSource.onmessage = (event) => {
                // Re-enable the send button and input field
                sendButton.disabled = false;
                messageInput.disabled = false;
                
                console.log('Received stream event:', event.data);
                const data = JSON.parse(event.data);
                
                // Handle special end marker
                if (data.content === '[DONE]') {
                    console.log('Stream completed with DONE marker');
                    stopButton.disabled = true;
                    cleanupStream();
                    return;
                }
                
                // Handle error response
                if (data.error) {
                    console.error('Stream error:', data.error);
                    if (currentAssistantMessage) {
                        currentAssistantMessage.innerHTML = `<div class="error-message">Error: ${data.error}</div>`;
                    }
                    stopButton.disabled = true;
                    cleanupStream();
                    return;
                }
                
                // Handle content chunks
                if (data.content) {
                    accumulatedResponse += data.content;
                    console.log('Accumulated response length:', accumulatedResponse.length);
                    
                    // Update the assistant message with the accumulating content
                    const parsedMarkdown = marked.parse(accumulatedResponse);
                    const cleanHtml = purify.sanitize(parsedMarkdown, purifyOptions);
                    currentAssistantMessage.innerHTML = cleanHtml;
                    
                    // Scroll to bottom as content comes in
                    chatContainer.scrollTop = chatContainer.scrollHeight;
                }
            };

        } catch (error) {
            console.error('Error:', error);
            appendMessage('System', 'An error occurred. Please try again.');
        }
    });

    // Add event listener for sign out
    document.querySelectorAll('[href*="logout"]').forEach(link => {
        link.addEventListener('click', function(event) {
            cleanupStream();
        });
    });

    // Handle beforeunload to cleanup on page close/refresh
    window.addEventListener('beforeunload', function() {
        cleanupStream();
    });

    function loadConversationHistory() {
        fetch("/conversation_history")
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                if (data.success) {
                    const conversationList = document.querySelector('.conversation-list');
                    if (!conversationList) return;
                    
                    conversationList.innerHTML = '';
                    
                    const groups = data.history;
                    
                    for (const groupName in groups) {
                        const groupConversations = groups[groupName];
                        if (groupConversations.length > 0) {
                            const header = document.createElement('div');
                            header.className = 'conversation-group-header';
                            header.textContent = groupName;
                            conversationList.appendChild(header);
                            
                            groupConversations.forEach(conv => {
                                const item = document.createElement('div');
                                item.className = 'conversation-item';
                                item.dataset.conversationId = conv.id;
                                
                                // Format the preview text to ensure it's not too long
                                const previewText = conv.preview || 'Empty conversation';
                                const truncatedPreview = previewText.length > 40 ? 
                                    previewText.substring(0, 37) + '...' : 
                                    previewText;
                                
                                item.innerHTML = `
                                    <div class="conversation-preview">${truncatedPreview}</div>
                                `;
                                
                                // Handle current conversation selection
                                if (conv.id === window.currentConversationId) {
                                    item.classList.add('selected');
                                }
                                
                                item.addEventListener('click', () => loadConversation(conv.id));
                                conversationList.appendChild(item);
                            });
                        }
                    }
                }
            })
            .catch(error => {
                console.error("Error loading conversation history:", error);
                // Optionally show a user-friendly message or just fail silently
                const conversationList = document.querySelector('.conversation-list');
                if (conversationList) {
                    conversationList.innerHTML = '<div class="error-message">Unable to load conversation history</div>';
                }
            });
    }

    async function loadConversation(conversationId) {
        try {
            // Close any existing stream
            if (currentEventSource) {
                currentEventSource.close();
                currentEventSource = null;
            }

            // Show loading indicator
            chatContainer.innerHTML = '<div class="loading-indicator">Loading conversation...</div>';

            const response = await fetch(`/get_conversation/${conversationId}`);
            const data = await response.json();
            
            if (data.success) {
                // Clear existing chat completely
                chatContainer.innerHTML = '';
                currentAssistantMessage = null;
                
                // Load chat history, skipping system messages
                if (data.chat_history && Array.isArray(data.chat_history)) {
                    data.chat_history.forEach(msg => {
                        // Skip system messages
                        if (msg.role === 'system') return;
                        
                        appendMessage(
                            msg.role.charAt(0).toUpperCase() + msg.role.slice(1),
                            msg.content
                        );
                    });
                }
                
                // Update conversation ID
                window.currentConversationId = data.conversation_id;
                
                // Update sidebar selection
                document.querySelectorAll('.conversation-item').forEach(item => {
                    if (item.dataset.conversationId === data.conversation_id) {
                        item.classList.add('selected');
                    } else {
                        item.classList.remove('selected');
                    }
                });
                
                // Scroll to bottom
                chatContainer.scrollTop = chatContainer.scrollHeight;
                
                console.log('Successfully loaded conversation:', data.conversation_id);
            } else {
                console.error("Failed to load conversation:", data.error);
                chatContainer.innerHTML = `
                    <div class="system-message error">
                        Failed to load conversation. Please try again.
                    </div>
                `;
            }
        } catch (error) {
            console.error("Error loading conversation:", error);
            chatContainer.innerHTML = `
                <div class="system-message error">
                    Failed to load conversation. Please try again.
                </div>
            `;
        }    }

    // Initial load of conversation history
    loadConversationHistory();
}

// Mobile Navigation Handler
function initMobileNav() {
    const menuButton = document.querySelector('.menu-button');
    const sidebar = document.querySelector('.sidebar');
    let isMenuOpen = false;

    if (!menuButton || !sidebar) return;

    // Toggle menu state with animation handling
    function toggleMenu(show = null) {
        isMenuOpen = show !== null ? show : !isMenuOpen;
        
        if (!isMenuOpen) {
            sidebar.classList.remove('active');
        } else {
            sidebar.classList.add('active');
        }
        
        menuButton.setAttribute('aria-expanded', isMenuOpen);
    }

    // Close menu
    function closeMenu() {
        toggleMenu(false);
    }

    // Open menu
    function openMenu() {
        toggleMenu(true);
    }

    // Handle menu button click
    menuButton.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleMenu();
    });

    // Replace the existing loadConversation function
    function loadConversation(conversationId) {
        // Close any existing stream
        if (window.currentEventSource) {
            window.currentEventSource.close();
            window.currentEventSource = null;
        }

        // First close the sidebar on mobile
        closeMenu();
        
        // Show loading indicator
        const chatContainer = document.querySelector('.chat-container');
        if (!chatContainer) return;
        chatContainer.innerHTML = '<div class="loading-indicator">Loading conversation...</div>';

        fetch(`/get_conversation/${conversationId}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                if (data.success) {
                    // Clear the chat container completely before adding new messages
                    chatContainer.innerHTML = '';
                    window.currentAssistantMessage = null;
                    
                    // Load chat history
                    if (data.chat_history && Array.isArray(data.chat_history)) {
                        // Filter out system messages
                        const filteredHistory = data.chat_history.filter(msg => msg.role !== 'system');
                        
                        // Render each message
                        filteredHistory.forEach(msg => {
                            const roleDiv = document.createElement('div');
                            roleDiv.className = `message-role ${msg.role}`;
                            roleDiv.textContent = msg.role === 'user' ? 'User' : 'Assistant';

                            const messageDiv = document.createElement('div');
                            messageDiv.className = msg.role === 'user' ? 'user-message' : 'assistant-message';
                            messageDiv.innerHTML = msg.role === 'assistant' ? 
                                window.DOMPurify.sanitize(window.marked.parse(msg.content), window.purifyOptions) : 
                                msg.content;

                            chatContainer.appendChild(roleDiv);
                            chatContainer.appendChild(messageDiv);
                        });
                    } 
                    // Update conversation ID
                    window.currentConversationId = data.conversation_id;

                    // Scroll to bottom
                    chatContainer.scrollTop = chatContainer.scrollHeight;
                }
            })
            .catch(error => {
                console.error('Error loading conversation:', error);
                chatContainer.innerHTML = `
                    <div class="system-message error">
                        Failed to load conversation. Please try again.
                    </div>
                `;
            });
    }

    // Add click handlers for conversation items
    document.querySelectorAll('.conversation-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const conversationId = item.dataset.conversationId;
            
            // Update selected state
            document.querySelectorAll('.conversation-item').forEach(i => {
                i.classList.remove('selected');
            });
            item.classList.add('selected');
            
            loadConversation(conversationId);
        });
    });

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
        if (isMenuOpen && !sidebar.contains(e.target) && e.target !== menuButton) {
            closeMenu();
        }
    });

    // Close menu when window is resized to desktop size
    window.addEventListener('resize', () => {
        if (window.innerWidth >= 768 && isMenuOpen) {
            closeMenu();
        }
    });

    // Handle escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && isMenuOpen) {
            closeMenu();
        }
    });
}

// Add mobile navigation styles
const mobileNavStyles = `
    .loading-indicator {
        padding: 1rem;
        text-align: center;
        color: #6B7280;
    }

    .conversation-item {
        position: relative;
        overflow: hidden;
    }

    .conversation-item.selected {
        background-color: var(--primary-lighter);
        border-left: 3px solid var(--primary-color);
    }

    .sidebar {
        transition: transform 0.3s ease;
    }

    @media (max-width: 768px) {
        .sidebar:not(.active) {
            pointer-events: none;
        }
    }
`;

// Add styles to document
const mobileStyleSheet = document.createElement('style');
mobileStyleSheet.textContent = mobileNavStyles;
document.head.appendChild(mobileStyleSheet);

// Add system message styles
const systemStyles = `
    .system-message {
        padding: 12px 16px;
        margin: 8px 0;
        border-radius: 8px;
        text-align: center;
        font-size: 14px;
    }

    .system-message.error {
        background-color: #FEE2E2;
        color: #991B1B;
        border: 1px solid #FCA5A5;
    }
`;

// Add styles to document
const styleSheet = document.createElement('style');
styleSheet.textContent = systemStyles;
document.head.appendChild(styleSheet);

// Initialize the chat when the DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        initChat();
        initMFA();
        initMobileNav();
        
        // Add flash message handling
        document.addEventListener('click', (e) => {
            if (e.target.matches('.flash .close-button')) {
                const flash = e.target.closest('.flash');
                if (flash) flash.remove();
            }
        });
    });
} else {
    initChat();
    initMFA();
    initMobileNav();
}