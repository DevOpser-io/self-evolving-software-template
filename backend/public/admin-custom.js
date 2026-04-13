// Custom JavaScript for AdminJS - Matching Bedrock Express Chat styling
document.addEventListener('DOMContentLoaded', function() {
  // Create a container for our custom navigation
  const navContainer = document.createElement('div');
  navContainer.className = 'custom-nav-container';
  
  // Create Chat link with icon
  const chatLink = document.createElement('a');
  chatLink.href = '/chat';
  chatLink.className = 'custom-nav-link chat-link';
  
  // Add chat icon
  const chatIcon = document.createElement('span');
  chatIcon.className = 'custom-nav-icon';
  chatIcon.innerHTML = '💬';
  chatLink.appendChild(chatIcon);
  
  // Add text
  const chatText = document.createTextNode('Chat');
  chatLink.appendChild(chatText);
  
  // Create Logout link with icon
  const logoutLink = document.createElement('a');
  logoutLink.href = '/admin-access/logout';
  logoutLink.className = 'custom-nav-link logout-link';
  
  // Add logout icon
  const logoutIcon = document.createElement('span');
  logoutIcon.className = 'custom-nav-icon';
  logoutIcon.innerHTML = '🚪';
  logoutLink.appendChild(logoutIcon);
  
  // Add text
  const logoutText = document.createTextNode('Logout');
  logoutLink.appendChild(logoutText);
  
  // Add links to container
  navContainer.appendChild(chatLink);
  navContainer.appendChild(logoutLink);
  
  // Add container to body
  document.body.appendChild(navContainer);
  
  // Add a small margin to the top of the main content to prevent overlap
  setTimeout(() => {
    const wrapperBoxes = document.querySelectorAll('.adminjs_WrapperBox');
    if (wrapperBoxes.length > 0) {
      wrapperBoxes.forEach(box => {
        box.style.marginTop = '10px';
      });
    }
  }, 500);
});
