/**
 * Mobile Navigation for Bedrock Express AI Chat
 * Handles sidebar toggle and conversation selection on mobile devices
 * CSP compliant - uses CSS classes instead of inline styles
 */
console.log('=== MOBILE-NAV.JS SCRIPT LOADED ===');
console.log('Document ready state:', document.readyState);
console.log('Current URL:', window.location.href);

document.addEventListener('DOMContentLoaded', function() {
  console.log('=== MOBILE-NAV.JS DOM CONTENT LOADED ===');

  // Basic DOM check
  console.log('Navbar elements found:', document.querySelectorAll('nav').length);
  console.log('Header elements found:', document.querySelectorAll('header').length);
  console.log('Total elements in DOM:', document.querySelectorAll('*').length);

  // Handle New Chat button clicks to close mobile navigation
  var newChatButton = document.getElementById('new-chat-btn');
  if (newChatButton) {
    var originalClickHandler = newChatButton.onclick;

    newChatButton.addEventListener('click', function(e) {
      // If we're on mobile, close the sidebar
      if (window.innerWidth < 769) {
        var sidebar = document.querySelector('.sidebar');
        if (sidebar) {
          sidebar.classList.remove('active');
          sidebar.classList.remove('sidebar-open');
          sidebar.classList.add('sidebar-closed');
        }
      }

      // Execute original click handler if it exists
      if (typeof originalClickHandler === 'function') {
        originalClickHandler(e);
      }
    });
  }

  // DOM elements
  var sidebar = document.querySelector('.sidebar');
  var allNavbarTogglers = document.querySelectorAll('.navbar-toggler');

  console.log('Mobile nav debug:');
  console.log('- Window width:', window.innerWidth);
  console.log('- Found navbar-togglers:', allNavbarTogglers.length);
  console.log('- Sidebar found:', !!sidebar);

  allNavbarTogglers.forEach(function(toggler, index) {
    console.log('- Toggler ' + index + ':', toggler);
    console.log('  - Current display:', getComputedStyle(toggler).display);
    console.log('  - Current visibility:', getComputedStyle(toggler).visibility);
  });

  // Function to update toggler visibility based on screen size using CSS classes
  function updateTogglerVisibility() {
    allNavbarTogglers.forEach(function(toggler, index) {
      if (window.innerWidth <= 768) {
        toggler.classList.add('force-visible');
        toggler.classList.remove('force-hidden');
        console.log('- Set toggler ' + index + ' to visible on mobile');
        console.log('  - After setting, display:', getComputedStyle(toggler).display);
      } else {
        toggler.classList.add('force-hidden');
        toggler.classList.remove('force-visible');
        console.log('- Set toggler ' + index + ' to hidden on desktop');
      }
    });
  }

  // Initial visibility update
  updateTogglerVisibility();

  // Update navbar-toggler visibility on window resize
  window.addEventListener('resize', function() {
    console.log('Window resized, width:', window.innerWidth);
    updateTogglerVisibility();
  });

  // Add a delayed check to see if something else is hiding the toggler
  setTimeout(function() {
    console.log('=== Delayed check (1 second later) ===');
    var newNavbarTogglers = document.querySelectorAll('.navbar-toggler');
    newNavbarTogglers.forEach(function(toggler, index) {
      console.log('- Toggler ' + index + ' after 1 second:');
      console.log('  - Display:', getComputedStyle(toggler).display);
      console.log('  - Visibility:', getComputedStyle(toggler).visibility);
      console.log('  - Opacity:', getComputedStyle(toggler).opacity);
      console.log('  - Position:', getComputedStyle(toggler).position);
      console.log('  - Z-index:', getComputedStyle(toggler).zIndex);

      // Force it visible again using CSS class
      if (window.innerWidth <= 768) {
        toggler.classList.add('force-visible');
        toggler.classList.remove('force-hidden');
        console.log('  - Forced visible again');
      }
    });
  }, 1000);

  // Bail early if we're not on a page with these elements
  if (!sidebar) return;

  // Setup conversation item click handlers
  function setupConversationItemHandlers() {
    document.querySelectorAll('.conversation-item').forEach(function(item) {
      item.addEventListener('click', function(e) {
        e.preventDefault();
        var conversationId = item.dataset.id;

        // Update selected state
        document.querySelectorAll('.conversation-item').forEach(function(i) {
          i.classList.remove('selected');
        });
        item.classList.add('selected');

        // Load the conversation
        if (typeof selectConversation === 'function') {
          selectConversation(conversationId);
        }

        // Close the menu on mobile using CSS classes
        if (window.innerWidth < 769) {
          var sidebarEl = document.querySelector('.sidebar');
          if (sidebarEl) {
            sidebarEl.classList.remove('active');
            sidebarEl.classList.remove('sidebar-open');
            sidebarEl.classList.add('sidebar-closed');
          }
        }
      });
    });
  }

  // Setup conversation item click handlers using a MutationObserver
  // This ensures it works even when the conversation list is loaded dynamically
  var conversationListObserver = new MutationObserver(function(mutations) {
    setupConversationItemHandlers();
  });

  var conversationList = document.querySelector('.conversation-list');
  if (conversationList) {
    conversationListObserver.observe(conversationList, { childList: true, subtree: true });

    // Also set up any existing items
    setupConversationItemHandlers();
  }

  // Bootstrap 5 handles navbar toggling automatically via data attributes
});
