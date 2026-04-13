/**
 * DevOpser Mobile Builder
 * Builder-first mobile app with auth modal after first prompt
 */

(function() {
  'use strict';

  // Configuration
  const API_BASE = window.location.origin;

  // State
  let isAuthenticated = false;
  let currentUser = null;
  let pendingPrompt = null;
  let currentSiteId = null;
  let authEmail = '';

  // Elements
  let loadingScreen;
  let chatMessages;
  let chatInput;
  let sendButton;
  let welcomeMessage;
  let generatingIndicator;
  let previewSuccess;
  let authModal;
  let mySitesBtn;
  let userAvatar;

  // Auth elements
  let authEmailStep;
  let authCodeStep;
  let authEmailInput;
  let authCodeInput;
  let authSendCodeBtn;
  let authVerifyCodeBtn;
  let authBackBtn;
  let authEmailDisplay;
  let authError;
  let authCodeError;

  /**
   * Initialize the app
   */
  async function init() {
    // Cache DOM elements
    cacheElements();

    // Check auth status
    await checkAuthStatus();

    // Check for pending prompt in localStorage
    const stored = localStorage.getItem('pendingPrompt');
    if (stored && isAuthenticated) {
      localStorage.removeItem('pendingPrompt');
      pendingPrompt = stored;
      processPrompt(stored);
    }

    // Hide loading screen
    if (loadingScreen) {
      loadingScreen.classList.add('hidden');
    }

    // Setup event listeners
    setupEventListeners();
  }

  /**
   * Cache DOM elements for performance
   */
  function cacheElements() {
    loadingScreen = document.getElementById('loadingScreen');
    chatMessages = document.getElementById('chatMessages');
    chatInput = document.getElementById('chatInput');
    sendButton = document.getElementById('sendButton');
    welcomeMessage = document.getElementById('welcomeMessage');
    generatingIndicator = document.getElementById('generatingIndicator');
    previewSuccess = document.getElementById('previewSuccess');
    authModal = document.getElementById('authModal');
    mySitesBtn = document.getElementById('mySitesBtn');
    userAvatar = document.getElementById('userAvatar');

    // Auth elements
    authEmailStep = document.getElementById('authEmailStep');
    authCodeStep = document.getElementById('authCodeStep');
    authEmailInput = document.getElementById('authEmail');
    authCodeInput = document.getElementById('authCode');
    authSendCodeBtn = document.getElementById('authSendCodeBtn');
    authVerifyCodeBtn = document.getElementById('authVerifyCodeBtn');
    authBackBtn = document.getElementById('authBackBtn');
    authEmailDisplay = document.getElementById('authEmailDisplay');
    authError = document.getElementById('authError');
    authCodeError = document.getElementById('authCodeError');
  }

  /**
   * Check authentication status
   */
  async function checkAuthStatus() {
    try {
      const response = await fetch(API_BASE + '/api/auth/status', {
        credentials: 'include'
      });
      const data = await response.json();
      if (data.authenticated && data.user) {
        isAuthenticated = true;
        currentUser = data.user;
        updateUIForAuthenticatedUser();
      }
    } catch (e) {
      console.log('[Builder] Not authenticated');
    }
  }

  /**
   * Setup event listeners
   */
  function setupEventListeners() {
    // Example prompts
    var prompts = document.querySelectorAll('.example-prompt');
    for (var i = 0; i < prompts.length; i++) {
      prompts[i].addEventListener('click', handleExamplePromptClick);
    }

    // Send button
    if (sendButton) {
      sendButton.addEventListener('click', handleSend);
    }

    // Enter key (but allow shift+enter for newlines)
    if (chatInput) {
      chatInput.addEventListener('keydown', handleInputKeydown);
      chatInput.addEventListener('input', handleInputResize);
    }

    // Auth handlers
    if (authSendCodeBtn) {
      authSendCodeBtn.addEventListener('click', handleSendCode);
    }
    if (authVerifyCodeBtn) {
      authVerifyCodeBtn.addEventListener('click', handleVerifyCode);
    }
    if (authBackBtn) {
      authBackBtn.addEventListener('click', handleAuthBack);
    }
    if (authEmailInput) {
      authEmailInput.addEventListener('keypress', handleEmailKeypress);
    }
    if (authCodeInput) {
      authCodeInput.addEventListener('keypress', handleCodeKeypress);
      authCodeInput.addEventListener('input', handleCodeInput);
    }

    // Preview success buttons
    var continueBtn = document.getElementById('continueEditingBtn');
    if (continueBtn) {
      continueBtn.addEventListener('click', handleContinueEditing);
    }
    var viewSitesBtn = document.getElementById('viewMySitesBtn');
    if (viewSitesBtn) {
      viewSitesBtn.addEventListener('click', handleViewMySites);
    }
  }

  /**
   * Handle example prompt click
   */
  function handleExamplePromptClick(e) {
    var prompt = e.currentTarget.getAttribute('data-prompt');
    if (chatInput && prompt) {
      chatInput.value = prompt;
      chatInput.focus();
    }
  }

  /**
   * Handle input keydown
   */
  function handleInputKeydown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  /**
   * Handle input resize
   */
  function handleInputResize() {
    if (chatInput) {
      chatInput.style.height = 'auto';
      chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px';
    }
  }

  /**
   * Update UI for authenticated user
   */
  function updateUIForAuthenticatedUser() {
    if (mySitesBtn) {
      mySitesBtn.classList.add('show');
    }
    if (userAvatar) {
      userAvatar.classList.add('show');
      if (currentUser && currentUser.email) {
        userAvatar.textContent = currentUser.email.charAt(0).toUpperCase();
      }
    }
  }

  /**
   * Handle send button click
   */
  function handleSend() {
    if (!chatInput) return;
    var prompt = chatInput.value.trim();
    if (!prompt) return;

    if (!isAuthenticated) {
      pendingPrompt = prompt;
      localStorage.setItem('pendingPrompt', prompt);
      showAuthModal();
      return;
    }

    processPrompt(prompt);
  }

  /**
   * Process a prompt
   */
  function processPrompt(prompt) {
    if (welcomeMessage) {
      welcomeMessage.style.display = 'none';
    }
    if (previewSuccess) {
      previewSuccess.classList.remove('show');
    }
    addMessage(prompt, 'user');
    if (chatInput) {
      chatInput.value = '';
      chatInput.style.height = 'auto';
    }

    if (generatingIndicator) {
      generatingIndicator.classList.add('active');
    }
    if (sendButton) {
      sendButton.disabled = true;
    }

    createSiteAndGenerate(prompt);
  }

  /**
   * Add a message to the chat
   */
  function addMessage(text, type) {
    if (!chatMessages || !generatingIndicator) return;
    var msg = document.createElement('div');
    msg.className = 'message ' + type;
    msg.textContent = text;
    chatMessages.insertBefore(msg, generatingIndicator);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  /**
   * Create site and generate content
   */
  async function createSiteAndGenerate(prompt) {
    try {
      // Create a new site
      var createResponse = await fetch(API_BASE + '/api/sites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: 'My Website',
          initialPrompt: prompt
        })
      });

      if (!createResponse.ok) {
        throw new Error('Failed to create site');
      }

      var site = await createResponse.json();
      currentSiteId = site.site ? site.site.id : site.id;

      // Chat with AI to generate
      var chatResponse = await fetch(API_BASE + '/api/sites/' + currentSiteId + '/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ message: prompt })
      });

      if (!chatResponse.ok) {
        throw new Error('Failed to generate website');
      }

      var result = await chatResponse.json();

      if (generatingIndicator) {
        generatingIndicator.classList.remove('active');
      }
      if (sendButton) {
        sendButton.disabled = false;
      }

      if (result.message) {
        addMessage(result.message, 'assistant');
      }

      // Show success state on mobile (since we can't show preview)
      if (result.siteConfig && previewSuccess) {
        previewSuccess.classList.add('show');
      }

    } catch (error) {
      console.error('[Builder] Error:', error);
      if (generatingIndicator) {
        generatingIndicator.classList.remove('active');
      }
      if (sendButton) {
        sendButton.disabled = false;
      }
      addMessage('Sorry, something went wrong. Please try again.', 'assistant');
    }
  }

  /**
   * Show auth modal
   */
  function showAuthModal() {
    if (authModal) {
      authModal.classList.add('active');
    }
    if (authEmailInput) {
      authEmailInput.focus();
    }
  }

  /**
   * Show auth step
   */
  function showAuthStep(step) {
    if (step === 'email') {
      if (authEmailStep) authEmailStep.classList.add('active');
      if (authCodeStep) authCodeStep.classList.remove('active');
      hideAuthErrors();
      if (authEmailInput) authEmailInput.focus();
    } else {
      if (authEmailStep) authEmailStep.classList.remove('active');
      if (authCodeStep) authCodeStep.classList.add('active');
      hideAuthErrors();
      if (authCodeInput) authCodeInput.focus();
    }
  }

  /**
   * Hide auth errors
   */
  function hideAuthErrors() {
    if (authError) authError.classList.remove('show');
    if (authCodeError) authCodeError.classList.remove('show');
    var authSuccess = document.getElementById('authSuccess');
    var authCodeSuccess = document.getElementById('authCodeSuccess');
    if (authSuccess) authSuccess.classList.remove('show');
    if (authCodeSuccess) authCodeSuccess.classList.remove('show');
  }

  /**
   * Handle send code button
   */
  async function handleSendCode() {
    if (!authEmailInput) return;
    var email = authEmailInput.value.trim();
    if (!email || email.indexOf('@') === -1) {
      if (authError) {
        authError.textContent = 'Please enter a valid email';
        authError.classList.add('show');
      }
      return;
    }

    if (authSendCodeBtn) {
      authSendCodeBtn.disabled = true;
      authSendCodeBtn.textContent = 'Sending...';
    }
    hideAuthErrors();

    try {
      var response = await fetch(API_BASE + '/auth/magic-link/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: email })
      });

      var data = await response.json();

      if (data.success) {
        authEmail = email;
        if (authEmailDisplay) {
          authEmailDisplay.textContent = email;
        }
        showAuthStep('code');
      } else {
        if (authError) {
          authError.textContent = data.error || 'Failed to send code';
          authError.classList.add('show');
        }
      }
    } catch (error) {
      if (authError) {
        authError.textContent = 'Network error. Please try again.';
        authError.classList.add('show');
      }
    }

    if (authSendCodeBtn) {
      authSendCodeBtn.disabled = false;
      authSendCodeBtn.textContent = 'Continue';
    }
  }

  /**
   * Handle verify code button
   */
  async function handleVerifyCode() {
    if (!authCodeInput) return;
    var code = authCodeInput.value.trim();
    if (code.length !== 6 || !/^\d{6}$/.test(code)) {
      if (authCodeError) {
        authCodeError.textContent = 'Please enter a valid 6-digit code';
        authCodeError.classList.add('show');
      }
      return;
    }

    if (authVerifyCodeBtn) {
      authVerifyCodeBtn.disabled = true;
      authVerifyCodeBtn.textContent = 'Verifying...';
    }
    hideAuthErrors();

    try {
      var response = await fetch(API_BASE + '/auth/magic-link/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: authEmail, code: code })
      });

      var data = await response.json();

      if (data.success) {
        isAuthenticated = true;
        currentUser = { email: authEmail };
        if (authModal) {
          authModal.classList.remove('active');
        }
        updateUIForAuthenticatedUser();

        // Process pending prompt
        if (pendingPrompt) {
          localStorage.removeItem('pendingPrompt');
          processPrompt(pendingPrompt);
          pendingPrompt = null;
        }
      } else if (data.requiresMfa) {
        window.location.href = data.redirect || '/auth/mfa-verify';
      } else {
        if (authCodeError) {
          authCodeError.textContent = data.error || 'Invalid code';
          authCodeError.classList.add('show');
        }
      }
    } catch (error) {
      if (authCodeError) {
        authCodeError.textContent = 'Network error. Please try again.';
        authCodeError.classList.add('show');
      }
    }

    if (authVerifyCodeBtn) {
      authVerifyCodeBtn.disabled = false;
      authVerifyCodeBtn.textContent = 'Verify & Create Website';
    }
  }

  /**
   * Handle auth back button
   */
  function handleAuthBack(e) {
    e.preventDefault();
    showAuthStep('email');
  }

  /**
   * Handle email input keypress
   */
  function handleEmailKeypress(e) {
    if (e.key === 'Enter') {
      handleSendCode();
    }
  }

  /**
   * Handle code input keypress
   */
  function handleCodeKeypress(e) {
    if (e.key === 'Enter') {
      handleVerifyCode();
    }
  }

  /**
   * Handle code input - only allow numbers
   */
  function handleCodeInput() {
    if (authCodeInput) {
      authCodeInput.value = authCodeInput.value.replace(/[^0-9]/g, '');
    }
  }

  /**
   * Handle continue editing button
   */
  function handleContinueEditing() {
    if (previewSuccess) {
      previewSuccess.classList.remove('show');
    }
    if (welcomeMessage) {
      welcomeMessage.style.display = 'none';
    }
  }

  /**
   * Handle view my sites button
   */
  function handleViewMySites() {
    window.location.href = '/sites';
  }

  // Start app when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
