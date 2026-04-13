/**
 * Mobile Navigation for Bedrock Express AI Chat
 * Handles sidebar toggle and conversation selection on mobile devices
 */
document.addEventListener('DOMContentLoaded', function() {
  // Handle New Chat button clicks to close mobile navigation
  const newChatButton = document.getElementById('new-chat-btn');
  if (newChatButton) {
    const originalClickHandler = newChatButton.onclick;
    
    newChatButton.addEventListener('click', function(e) {
      // If we're on mobile, close the sidebar
      if (window.innerWidth < 769) {
        // Find the sidebar element
        const sidebar = document.querySelector('.sidebar');
        if (sidebar) {
          sidebar.classList.remove('active');
          sidebar.style.transform = 'translateX(-100%)';
          
          // Update any menu button states
          const menuButton = document.querySelector('.menu-button');
          if (menuButton) {
            menuButton.setAttribute('aria-expanded', 'false');
          }
        }
      }
      
      // Execute original click handler if it exists
      if (typeof originalClickHandler === 'function') {
        originalClickHandler(e);
      }
    });
  }
  // DOM elements
  const menuButton = document.querySelector('.menu-button');
  const sidebar = document.querySelector('.sidebar');
  let isMenuOpen = false;

  // Show navbar-togglers on mobile, hide on desktop
  const allNavbarTogglers = document.querySelectorAll('.navbar-toggler');
  allNavbarTogglers.forEach(toggler => {
    if (window.innerWidth <= 768) {
      toggler.style.display = 'block';
    } else {
      toggler.style.display = 'none';
    }
  });
  
  // Update navbar-toggler visibility on window resize
  window.addEventListener('resize', () => {
    allNavbarTogglers.forEach(toggler => {
      if (window.innerWidth <= 768) {
        toggler.style.display = 'block';
      } else {
        toggler.style.display = 'none';
      }
    });
  });
  
  // Remove any duplicate menu-button elements that aren't our primary one
  const allMenuButtons = document.querySelectorAll('.menu-button');
  if (allMenuButtons.length > 1) {
    // Keep only the first one (our main menu button)
    for (let i = 1; i < allMenuButtons.length; i++) {
      allMenuButtons[i].style.display = 'none';
    }
  }

  // Bail early if we're not on a page with these elements
  if (!menuButton || !sidebar) return;
  
  // Create close button for mobile sidebar only
  const closeButton = document.createElement('button');
  closeButton.className = 'close-sidebar-button';
  closeButton.setAttribute('aria-label', 'Close sidebar');
  closeButton.innerHTML = '<i class="bi bi-x-lg"></i>';
  
  // Add the close button to the sidebar itself (not inside the header)
  // This positions it better for mobile view
  if (sidebar) {
    sidebar.appendChild(closeButton);
    
    // Only show the close button on mobile devices
    closeButton.style.display = 'none';
    if (window.innerWidth < 769) {
      closeButton.style.display = 'flex';
    }
    
    // Update visibility on window resize
    window.addEventListener('resize', function() {
      closeButton.style.display = window.innerWidth < 769 ? 'flex' : 'none';
    });
  }

  // Toggle menu state with animation handling
  function toggleMenu(show = null) {
    isMenuOpen = show !== null ? show : !isMenuOpen;
    
    if (isMenuOpen) {
      sidebar.classList.add('active');
      sidebar.style.transform = 'translateX(0)';
      menuButton.setAttribute('aria-expanded', 'true');
    } else {
      sidebar.classList.remove('active');
      sidebar.style.transform = 'translateX(-100%)';
      menuButton.setAttribute('aria-expanded', 'false');
    }
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
  
  // Handle close button click
  closeButton.addEventListener('click', (e) => {
    e.stopPropagation();
    closeMenu();
  });

  // Fix conversation item click events for mobile
  function setupConversationItemHandlers() {
    document.querySelectorAll('.conversation-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const conversationId = item.dataset.conversationId;
        
        // Update selected state
        document.querySelectorAll('.conversation-item').forEach(i => {
          i.classList.remove('selected');
        });
        item.classList.add('selected');
        
        // Load the conversation
        loadConversation(conversationId);
        
        // Close the menu on mobile
        if (window.innerWidth < 769) {
          closeMenu();
        }
      });
    });
  }

  // Load a conversation
  function loadConversation(conversationId) {
    console.log('Loading conversation:', conversationId);
    
    // Get the chat container
    const chatContainer = document.querySelector('.chat-container');
    if (!chatContainer) return;

    // Show loading state
    chatContainer.innerHTML = '<div class="loading-indicator">Loading conversation...</div>';

    // Close any existing event source
    if (window.currentEventSource) {
      window.currentEventSource.close();
      window.currentEventSource = null;
    }

    // Fetch the conversation using the correct endpoint
    fetch(`/get_conversation/${conversationId}`)
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          chatContainer.innerHTML = '';
          
          // Reset any active streaming
          if (window.currentAssistantMessage) {
            window.currentAssistantMessage = null;
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
          
          // Load chat history
          if (data.chat_history && data.chat_history.length > 0) {
            data.chat_history.forEach(msg => {
              const roleDiv = document.createElement('div');
              roleDiv.className = `message-role ${msg.role === 'user' ? 'user' : ''}`;
              roleDiv.textContent = msg.role.charAt(0).toUpperCase() + msg.role.slice(1);

              const messageDiv = document.createElement('div');
              messageDiv.className = msg.role === 'user' ? 'user-message' : 'assistant-message';
              
              // Handle markdown for assistant messages if marked is available
              if (msg.role === 'assistant' && window.marked) {
                const purifyOptions = {
                  ALLOWED_TAGS: [
                    'p', 'br', 'b', 'i', 'em', 'strong', 'a', 'ul', 'ol', 'li',
                    'code', 'pre', 'h1', 'h2', 'h3', 'blockquote', 'span'
                  ],
                  ALLOWED_ATTR: ['href', 'target', 'rel', 'class']
                };
                
                // If DOMPurify is available, sanitize the HTML
                if (window.DOMPurify) {
                  messageDiv.innerHTML = window.DOMPurify.sanitize(window.marked.parse(msg.content), purifyOptions);
                } else {
                  messageDiv.innerHTML = window.marked.parse(msg.content);
                }
              } else {
                messageDiv.textContent = msg.content;
              }

              chatContainer.appendChild(roleDiv);
              chatContainer.appendChild(messageDiv);
            });
          }
          
          // Scroll to bottom
          chatContainer.scrollTop = chatContainer.scrollHeight;
        } else {
          console.error('Failed to load conversation:', data.error);
          chatContainer.innerHTML = `
            <div class="system-message error">
              Failed to load conversation. Please try again.
            </div>
          `;
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

  // Setup conversation item click handlers using a MutationObserver
  // This ensures it works even when the conversation list is loaded dynamically
  const conversationListObserver = new MutationObserver(function(mutations) {
    setupConversationItemHandlers();
  });

  const conversationList = document.querySelector('.conversation-list');
  if (conversationList) {
    conversationListObserver.observe(conversationList, { childList: true, subtree: true });
    
    // Also set up any existing items
    setupConversationItemHandlers();
    
    // Add additional styles for conversation list
    const additionalStyles = document.createElement('style');
    additionalStyles.textContent = `
      .conversation-item.selected {
        background-color: var(--primary-lighter);
        border-left: 3px solid var(--primary-color);
      }
      
      .conversation-preview {
        font-size: 0.85rem;
        color: #4b5563;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        display: block;
        width: 100%;
      }
      
      .loading-indicator {
        padding: 1rem;
        text-align: center;
        color: #6B7280;
      }
      
      @media (max-width: 768px) {
        .sidebar {
          transition: transform 0.3s ease;
        }
        
        .sidebar:not(.active) {
          pointer-events: none;
        }
      }
    `;
    document.head.appendChild(additionalStyles);
  }

  // Close menu when clicking outside on mobile
  document.addEventListener('click', (e) => {
    if (isMenuOpen && !sidebar.contains(e.target) && e.target !== menuButton) {
      closeMenu();
    }
  });

  // Close menu when escape key is pressed
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isMenuOpen) {
      closeMenu();
    }
  });

  // Adjust menu when window is resized
  window.addEventListener('resize', () => {
    if (window.innerWidth >= 769 && isMenuOpen) {
      closeMenu();
    }
  });
});
