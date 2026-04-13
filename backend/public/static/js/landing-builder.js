/**
 * DevOpser Landing Builder JavaScript
 * External file for strict CSP compliance
 */
(function() {
  'use strict';

  // Read server data from JSON data block
  var serverDataEl = document.getElementById('server-data');
  var serverData = serverDataEl ? JSON.parse(serverDataEl.textContent) : {};

  // State
  var isAuthenticated = serverData.isAuthenticated || false;
  var currentUser = serverData.currentUser || null;
  var pendingPrompt = null;
  var currentSiteId = null;
  var currentSiteConfig = null;
  var authEmail = '';
  var hasSeenFirstPreview = false; // Track if user has seen their first preview

  // Elements
  var chatMessages = document.getElementById('chatMessages');
  var chatInput = document.getElementById('chatInput');
  var sendButton = document.getElementById('sendButton');
  var welcomeMessage = document.getElementById('welcomeMessage');
  var generatingIndicator = document.getElementById('generatingIndicator');
  var authModal = document.getElementById('authModal');
  var previewPlaceholder = document.getElementById('previewPlaceholder');
  var previewContentContainer = document.getElementById('previewContentContainer');
  var previewContent = document.getElementById('previewContent');
  var previewModeBanner = document.getElementById('previewModeBanner');
  var floatingSaveContainer = document.getElementById('floatingSaveContainer');
  var floatingSaveBtn = document.getElementById('floatingSaveBtn');
  var previewUrl = document.getElementById('previewUrl');
  var previewUrlText = document.getElementById('previewUrlText');
  var mySitesLink = document.getElementById('mySitesLink');
  var userMenu = document.getElementById('userMenu');
  var userAvatar = document.getElementById('userAvatar');
  var publishBtn = document.getElementById('publishBtn');

      // Auth elements
      const authEmailStep = document.getElementById('authEmailStep');
      const authCodeStep = document.getElementById('authCodeStep');
      const authEmailInput = document.getElementById('authEmail');
      const authCodeInput = document.getElementById('authCode');
      const authSendCodeBtn = document.getElementById('authSendCodeBtn');
      const authVerifyCodeBtn = document.getElementById('authVerifyCodeBtn');
      const authBackBtn = document.getElementById('authBackBtn');
      const authCloseBtn = document.getElementById('authCloseBtn');
      const authEmailDisplay = document.getElementById('authEmailDisplay');
      const authError = document.getElementById('authError');
      const authSuccess = document.getElementById('authSuccess');
      const authCodeError = document.getElementById('authCodeError');
      const authCodeSuccess = document.getElementById('authCodeSuccess');

      // Initialize
      function init() {
        if (isAuthenticated && currentUser) {
          updateUIForAuthenticatedUser();

          // Check for pending site config after auth (stored before page reload)
          const pendingSiteConfig = localStorage.getItem('pendingSiteConfig');
          const pendingSitePrompt = localStorage.getItem('pendingSitePrompt');

          if (pendingSiteConfig) {
            localStorage.removeItem('pendingSiteConfig');
            try {
              const config = JSON.parse(pendingSiteConfig);
              console.log('[Landing] Found pending site config, creating site...');
              createSiteAndRedirect(config);
              return; // Don't continue initialization, we're redirecting
            } catch (e) {
              console.error('[Landing] Error parsing pending site config:', e);
            }
          } else if (pendingSitePrompt) {
            localStorage.removeItem('pendingSitePrompt');
            console.log('[Landing] Found pending site prompt, creating site...');
            createSiteFromPromptAndRedirect(pendingSitePrompt);
            return; // Don't continue initialization, we're redirecting
          }
        }

        // Check for pending prompt in localStorage (older flow)
        const stored = localStorage.getItem('pendingPrompt');
        if (stored && isAuthenticated) {
          localStorage.removeItem('pendingPrompt');
          pendingPrompt = stored;
          processPrompt(stored);
        }

        // Example prompts - click to fill input and submit
        document.querySelectorAll('.example-prompt').forEach(btn => {
          btn.addEventListener('click', () => {
            chatInput.value = btn.dataset.prompt;
            handleSend();
          });
        });

        // Send button
        sendButton.addEventListener('click', handleSend);

        // Enter key
        chatInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
          }
        });

        // Auto-resize textarea
        chatInput.addEventListener('input', () => {
          chatInput.style.height = 'auto';
          chatInput.style.height = Math.min(chatInput.scrollHeight, 150) + 'px';
        });

        // Auth modal handlers
        authSendCodeBtn.addEventListener('click', handleSendCode);
        authVerifyCodeBtn.addEventListener('click', handleVerifyCode);
        authBackBtn.addEventListener('click', (e) => {
          e.preventDefault();
          showAuthStep('email');
        });
        authCloseBtn.addEventListener('click', closeAuthModal);

        // Close modal on overlay click
        authModal.addEventListener('click', (e) => {
          if (e.target === authModal) {
            closeAuthModal();
          }
        });

        authEmailInput.addEventListener('keypress', (e) => {
          if (e.key === 'Enter') handleSendCode();
        });

        authCodeInput.addEventListener('keypress', (e) => {
          if (e.key === 'Enter') handleVerifyCode();
        });

        authCodeInput.addEventListener('input', function() {
          this.value = this.value.replace(/[^0-9]/g, '');
        });

        // Close modal on overlay click
        authModal.addEventListener('click', (e) => {
          if (e.target === authModal) {
            // Don't close if they have a pending prompt
            if (!pendingPrompt) {
              authModal.classList.remove('active');
            }
          }
        });

        // Preview content click - clicking on preview triggers signup modal (only in preview mode)
        previewContent.addEventListener('click', () => {
          if (!isAuthenticated && previewContent.classList.contains('preview-mode')) {
            showAuthModal();
          }
        });

        // Floating save button - triggers signup modal
        floatingSaveBtn.addEventListener('click', () => {
          showAuthModal();
        });
      }

      function updateUIForAuthenticatedUser() {
        mySitesLink.classList.add('show');
        userMenu.classList.add('authenticated');
        if (currentUser && currentUser.email) {
          userAvatar.textContent = currentUser.email.charAt(0).toUpperCase();
        }
      }

      function handleSend() {
        const prompt = chatInput.value.trim();
        if (!prompt) return;

        // New flow: Allow first prompt without auth, require auth for changes
        if (!isAuthenticated && hasSeenFirstPreview) {
          // They've seen their preview, now require signup to make changes
          pendingPrompt = prompt;
          localStorage.setItem('pendingPrompt', prompt);
          showAuthModal();
          return;
        }

        processPrompt(prompt);
      }

      function processPrompt(prompt) {
        // Hide welcome, show user message
        welcomeMessage.style.display = 'none';
        addMessage(prompt, 'user');
        chatInput.value = '';
        chatInput.style.height = 'auto';

        // Show generating indicator
        generatingIndicator.classList.add('active');
        sendButton.disabled = true;

        // Route to appropriate generator
        if (isAuthenticated) {
          // Authenticated user: create real site
          createSiteAndGenerate(prompt);
        } else {
          // Anonymous user: generate preview only
          generateAnonymousPreview(prompt);
        }
      }

      function addMessage(text, type) {
        const msg = document.createElement('div');
        msg.className = `message ${type}`;

        if (type === 'assistant' && typeof marked !== 'undefined') {
          // Format assistant messages with markdown
          const rawHtml = marked.parse(text);
          msg.innerHTML = typeof DOMPurify !== 'undefined' ? DOMPurify.sanitize(rawHtml) : rawHtml;
        } else {
          msg.textContent = text;
        }

        chatMessages.insertBefore(msg, generatingIndicator);
        chatMessages.scrollTop = chatMessages.scrollHeight;
      }

      // For authenticated users: create site and redirect to builder
      async function createSiteAndGenerate(prompt) {
        try {
          // Create a new site with AI-generated config
          const createResponse = await fetch('/api/sites', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: 'My Website',
              initialPrompt: prompt
            })
          });

          if (!createResponse.ok) {
            const errorData = await createResponse.json().catch(() => ({}));
            throw new Error(errorData.error || 'Failed to create site');
          }

          const response = await createResponse.json();
          const siteData = response.site;
          console.log('[Landing] Site created:', siteData.id, 'redirecting to builder...');

          // Redirect to builder immediately - no need to render preview here
          window.location.href = `/sites/${siteData.id}/builder`;

        } catch (error) {
          console.error('[Landing] Error creating site:', error);
          generatingIndicator.classList.remove('active');
          sendButton.disabled = false;
          addMessage('Sorry, something went wrong. Please try again.', 'assistant');
        }
      }

      // Generate anonymous preview (no auth required for first prompt)
      async function generateAnonymousPreview(prompt) {
        try {
          console.log('[Landing] Generating anonymous preview...');

          const response = await fetch('/api/preview/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt })
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || 'Failed to generate preview');
          }

          const result = await response.json();
          console.log('[Landing] Anonymous preview generated, sections:', result.config?.sections?.length || 0);

          generatingIndicator.classList.remove('active');
          sendButton.disabled = false;

          if (result.config && result.config.sections && result.config.sections.length > 0) {
            currentSiteConfig = result.config;
            hasSeenFirstPreview = true; // Mark that they've seen their first preview
            renderPreview(result.config);
            updatePreviewUrl('preview');

            // Show signup prompt message
            addMessage(result.message || "Here's your website preview! Sign up to save it and make more changes.", 'assistant');

            // Update chat input placeholder to encourage signup
            chatInput.placeholder = 'Sign up to save and customize your site...';
          } else {
            addMessage('I had trouble generating that. Try describing your website in more detail!', 'assistant');
          }

        } catch (error) {
          console.error('[Landing] Error generating preview:', error);
          generatingIndicator.classList.remove('active');
          sendButton.disabled = false;
          addMessage('Sorry, something went wrong. Please try again.', 'assistant');
        }
      }

      // Render preview directly to DOM (like builder does)
      function renderPreview(config) {
        try {
          console.log('[Preview] Rendering config with', config?.sections?.length || 0, 'sections');

          // Defensive: ensure config is valid
          if (!config || typeof config !== 'object') {
            console.error('[Preview] Invalid config:', config);
            config = { theme: {}, sections: [] };
          }

          const primaryColor = config.theme?.primaryColor || '#3B82F6';
          const secondaryColor = config.theme?.secondaryColor || '#10B981';
          const sections = (config.sections || [])
            .filter(s => s && s.visible !== false)
            .sort((a, b) => (a.order || 0) - (b.order || 0));

          if (sections.length === 0) {
            console.warn('[Preview] No sections to render');
            return;
          }

          let html = '<div class="site-preview" id="sitePreviewContent">';

          sections.forEach(function(section) {
            const sectionId = section.id || section.type;

            if (section.type === 'hero') {
              const heroBgStart = section.content.backgroundColorStart || primaryColor;
              const heroBgEnd = section.content.backgroundColorEnd || secondaryColor;
              const heroImage = section.content.backgroundImage || '';
              const isDark = isColorDark(heroBgStart) || isColorDark(heroBgEnd);
              let heroClass = isDark ? 'section-hero dark-bg' : 'section-hero';
              if (heroImage) {
                heroClass += ' has-bg-image';
              }

              html += '<div class="' + heroClass + '" data-section-id="' + sectionId + '" data-bg-start="' + heroBgStart + '" data-bg-end="' + heroBgEnd + '" data-bg-image="' + escapeHtml(heroImage) + '">';
              html += '<h1>' + escapeHtml(section.content.headline || '') + '</h1>';
              html += '<p>' + escapeHtml(section.content.subheadline || '') + '</p>';
              if (section.content.ctaText) {
                const ctaBtnClass = isDark ? 'cta-btn cta-btn-white' : 'cta-btn';
                html += '<a href="' + escapeHtml(section.content.ctaLink || '#') + '" class="' + ctaBtnClass + '">' + escapeHtml(section.content.ctaText) + '</a>';
              }
              html += '</div>';

            } else if (section.type === 'features') {
              html += '<div class="section-features" data-section-id="' + sectionId + '">';
              html += '<h2>' + escapeHtml(section.content.title || '') + '</h2>';
              html += '<div class="features-grid">';
              (section.content.items || []).forEach(function(item) {
                const iconName = item.icon || 'star';
                html += '<div class="feature-item">';
                html += '<div class="feature-icon"><i class="fa-solid fa-' + escapeHtml(iconName) + '"></i></div>';
                html += '<h3>' + escapeHtml(item.title || '') + '</h3>';
                html += '<p>' + escapeHtml(item.description || '') + '</p>';
                html += '</div>';
              });
              html += '</div></div>';

            } else if (section.type === 'about') {
              const imgPos = section.content.imagePosition || 'right';
              const aboutClass = 'section-about about-image-' + imgPos;
              html += '<div class="' + aboutClass + '" data-section-id="' + sectionId + '">';
              html += '<div class="about-content">';
              html += '<h2>' + escapeHtml(section.content.title || '') + '</h2>';
              html += '<p>' + escapeHtml(section.content.content || '') + '</p>';
              html += '</div>';
              if (section.content.image) {
                html += '<div class="about-image">';
                html += '<img src="' + escapeHtml(section.content.image) + '" alt="' + escapeHtml(section.content.title || 'About') + '">';
                html += '</div>';
              }
              html += '</div>';

            } else if (section.type === 'testimonials') {
              html += '<div class="section-testimonials" data-section-id="' + sectionId + '">';
              html += '<h2>' + escapeHtml(section.content.title || 'Testimonials') + '</h2>';
              html += '<div class="testimonials-grid">';
              (section.content.items || []).forEach(function(item) {
                html += '<div class="testimonial-item">';
                if (item.avatar) {
                  html += '<div class="testimonial-avatar"><img src="' + escapeHtml(item.avatar) + '" alt="' + escapeHtml(item.author || '') + '"></div>';
                }
                html += '<p class="testimonial-quote">"' + escapeHtml(item.quote || '') + '"</p>';
                html += '<p class="testimonial-author">' + escapeHtml(item.author || '') + '</p>';
                if (item.role) {
                  html += '<p class="testimonial-role">' + escapeHtml(item.role) + '</p>';
                }
                html += '</div>';
              });
              html += '</div></div>';

            } else if (section.type === 'pricing') {
              html += '<div class="section-pricing" data-section-id="' + sectionId + '">';
              html += '<h2>' + escapeHtml(section.content.title || 'Pricing') + '</h2>';
              if (section.content.subtitle) {
                html += '<p class="pricing-subtitle">' + escapeHtml(section.content.subtitle) + '</p>';
              }
              html += '<div class="pricing-grid">';
              (section.content.items || []).forEach(function(item) {
                const itemClass = item.highlighted ? 'pricing-item highlighted' : 'pricing-item';
                html += '<div class="' + itemClass + '">';
                html += '<p class="pricing-name">' + escapeHtml(item.name || '') + '</p>';
                html += '<p><span class="pricing-price">' + escapeHtml(item.price || '') + '</span>';
                if (item.period) {
                  html += '<span class="pricing-period">' + escapeHtml(item.period) + '</span>';
                }
                html += '</p>';
                if (item.features && item.features.length > 0) {
                  html += '<ul class="pricing-features">';
                  item.features.forEach(function(feature) {
                    html += '<li>' + escapeHtml(feature) + '</li>';
                  });
                  html += '</ul>';
                }
                if (item.ctaText) {
                  html += '<a href="' + escapeHtml(item.ctaLink || '#') + '" class="pricing-cta">' + escapeHtml(item.ctaText) + '</a>';
                }
                html += '</div>';
              });
              html += '</div></div>';

            } else if (section.type === 'contact') {
              html += '<div class="section-contact" data-section-id="' + sectionId + '">';
              html += '<h2>' + escapeHtml(section.content.title || '') + '</h2>';
              html += '<p>' + escapeHtml(section.content.subtitle || '') + '</p>';
              if (section.content.email) {
                html += '<p><i class="fa-solid fa-envelope"></i> ' + escapeHtml(section.content.email) + '</p>';
              }
              html += '</div>';

            } else if (section.type === 'footer') {
              const copyright = section.content.copyright || ('© ' + new Date().getFullYear() + ' ' + (section.content.companyName || config.siteName || ''));
              html += '<div class="section-footer" data-section-id="' + sectionId + '">';
              html += '<p>' + escapeHtml(copyright) + '</p>';
              html += '</div>';
            }
          });

          html += '</div>';

          // Show preview container, hide placeholder
          previewPlaceholder.style.display = 'none';
          previewContentContainer.classList.add('active');

          // Render to DOM
          previewContent.innerHTML = html;

          // Apply CSS variables
          const previewEl = document.getElementById('sitePreviewContent');
          if (previewEl) {
            previewEl.style.setProperty('--primary-color', primaryColor);
            previewEl.style.setProperty('--secondary-color', secondaryColor);
          }

          // Apply hero background colors and image
          const heroEl = previewContent.querySelector('.section-hero');
          if (heroEl) {
            const bgStart = heroEl.getAttribute('data-bg-start');
            const bgEnd = heroEl.getAttribute('data-bg-end');
            const bgImage = heroEl.getAttribute('data-bg-image');
            if (bgStart && bgEnd) {
              heroEl.style.setProperty('--hero-bg-start', bgStart);
              heroEl.style.setProperty('--hero-bg-end', bgEnd);
              if (!bgImage) {
                heroEl.style.background = 'linear-gradient(135deg, ' + bgStart + ', ' + bgEnd + ')';
              }
            }
            // Apply background image if set
            if (bgImage) {
              heroEl.style.setProperty('--hero-bg-image', 'url(' + bgImage + ')');
              heroEl.classList.add('has-bg-image');
            }
          }

          previewUrl.classList.add('live');
          console.log('[Preview] Preview rendered successfully');

          // Show preview mode elements for unauthenticated users
          if (!isAuthenticated) {
            previewModeBanner.classList.add('active');
            previewContent.classList.add('preview-mode');
            floatingSaveContainer.classList.add('active');
          } else {
            // Hide preview mode elements for authenticated users
            previewModeBanner.classList.remove('active');
            previewContent.classList.remove('preview-mode');
            floatingSaveContainer.classList.remove('active');
          }

        } catch (error) {
          console.error('[Preview] Error rendering preview:', error);
          previewPlaceholder.style.display = 'flex';
          previewContentContainer.classList.remove('active');
        }
      }

      // Helper: check if a color is dark
      function isColorDark(color) {
        if (!color || !color.startsWith('#')) return false;
        const hex = color.replace('#', '');
        const r = parseInt(hex.substr(0, 2), 16);
        const g = parseInt(hex.substr(2, 2), 16);
        const b = parseInt(hex.substr(4, 2), 16);
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        return luminance < 0.5;
      }

      function updatePreviewUrl(slug) {
        previewUrlText.textContent = `${slug}.example.com`;
      }

      // Escape HTML to prevent XSS
      function escapeHtml(str) {
        if (!str) return '';
        return String(str)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#039;');
      }

      // Auth handlers
      function showAuthModal() {
        authModal.classList.add('active');
        authEmailInput.focus();
      }

      function closeAuthModal() {
        authModal.classList.remove('active');
        hideAuthErrors();
      }

      function showAuthStep(step) {
        if (step === 'email') {
          authEmailStep.classList.add('active');
          authCodeStep.classList.remove('active');
          hideAuthErrors();
          authEmailInput.focus();
        } else {
          authEmailStep.classList.remove('active');
          authCodeStep.classList.add('active');
          hideAuthErrors();
          authCodeInput.focus();
        }
      }

      function hideAuthErrors() {
        authError.classList.remove('show');
        authSuccess.classList.remove('show');
        authCodeError.classList.remove('show');
        authCodeSuccess.classList.remove('show');
      }

      async function handleSendCode() {
        const email = authEmailInput.value.trim();
        if (!email || !email.includes('@')) {
          authError.textContent = 'Please enter a valid email';
          authError.classList.add('show');
          return;
        }

        authSendCodeBtn.disabled = true;
        authSendCodeBtn.textContent = 'Sending...';
        hideAuthErrors();

        try {
          const response = await fetch('/auth/magic-link/request', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
          });

          const data = await response.json();

          if (data.success) {
            authEmail = email;
            authEmailDisplay.textContent = email;
            showAuthStep('code');
          } else {
            authError.textContent = data.error || 'Failed to send code';
            authError.classList.add('show');
          }
        } catch (error) {
          authError.textContent = 'Network error. Please try again.';
          authError.classList.add('show');
        }

        authSendCodeBtn.disabled = false;
        authSendCodeBtn.textContent = 'Continue';
      }

      async function handleVerifyCode() {
        const code = authCodeInput.value.trim();
        if (code.length !== 6 || !/^\d{6}$/.test(code)) {
          authCodeError.textContent = 'Please enter a valid 6-digit code';
          authCodeError.classList.add('show');
          return;
        }

        authVerifyCodeBtn.disabled = true;
        authVerifyCodeBtn.textContent = 'Verifying...';
        hideAuthErrors();

        try {
          const response = await fetch('/auth/magic-link/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({ email: authEmail, code })
          });

          const data = await response.json();

          if (data.success) {
            isAuthenticated = true;
            currentUser = { email: authEmail };
            localStorage.removeItem('pendingPrompt');

            // After successful login, create the site directly via API
            // This avoids session cookie issues that can occur with page reload
            if (currentSiteConfig) {
              authVerifyCodeBtn.textContent = 'Creating your site...';
              // Create site directly now that we're authenticated
              try {
                const createResponse = await fetch('/api/sites', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  credentials: 'same-origin',
                  body: JSON.stringify({
                    name: currentSiteConfig.siteName || 'My Website',
                    draftConfig: currentSiteConfig
                  })
                });

                if (createResponse.ok) {
                  const createData = await createResponse.json();
                  if (createData.site && createData.site.id) {
                    window.location.href = '/sites/' + createData.site.id + '/builder';
                    return;
                  }
                }
                // Fallback: store config and reload
                localStorage.setItem('pendingSiteConfig', JSON.stringify(currentSiteConfig));
                window.location.href = '/?auth=success';
              } catch (e) {
                console.error('[Landing] Error creating site after login:', e);
                localStorage.setItem('pendingSiteConfig', JSON.stringify(currentSiteConfig));
                window.location.href = '/?auth=success';
              }
            } else if (pendingPrompt) {
              authVerifyCodeBtn.textContent = 'Creating your site...';
              // Create site from prompt directly
              try {
                const createResponse = await fetch('/api/sites', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  credentials: 'same-origin',
                  body: JSON.stringify({
                    name: 'My Website',
                    initialPrompt: pendingPrompt
                  })
                });

                if (createResponse.ok) {
                  const createData = await createResponse.json();
                  if (createData.site && createData.site.id) {
                    window.location.href = '/sites/' + createData.site.id + '/builder';
                    return;
                  }
                }
                // Fallback: store prompt and reload
                localStorage.setItem('pendingSitePrompt', pendingPrompt);
                window.location.href = '/?auth=success';
              } catch (e) {
                console.error('[Landing] Error creating site after login:', e);
                localStorage.setItem('pendingSitePrompt', pendingPrompt);
                window.location.href = '/?auth=success';
              }
            } else {
              // No config or prompt, just go to sites list
              window.location.href = '/sites';
            }
          } else if (data.requiresMfa) {
            // Handle MFA - redirect to MFA page
            window.location.href = data.redirect || '/auth/mfa-verify';
          } else {
            authCodeError.textContent = data.error || 'Invalid code';
            authCodeError.classList.add('show');
          }
        } catch (error) {
          authCodeError.textContent = 'Network error. Please try again.';
          authCodeError.classList.add('show');
        }

        authVerifyCodeBtn.disabled = false;
        authVerifyCodeBtn.textContent = 'Verify & Create Website';
      }

      // Create site with existing config and redirect to builder
      async function createSiteAndRedirect(config) {
        try {
          const response = await fetch('/api/sites', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({
              name: config.siteName || 'My Website',
              draftConfig: config
            })
          });

          if (!response.ok) {
            // If redirected to login, the session wasn't preserved - reload page
            if (response.redirected || response.status === 302) {
              window.location.reload();
              return;
            }
            throw new Error('Failed to create site');
          }

          const data = await response.json();
          const siteId = data.site.id;

          // Redirect to builder
          window.location.href = `/sites/${siteId}/builder`;
        } catch (error) {
          console.error('[Landing] Error creating site:', error);
          authCodeError.textContent = 'Failed to create site. Please try again.';
          authCodeError.classList.add('show');
        }
      }

      // Create site from prompt and redirect to builder
      async function createSiteFromPromptAndRedirect(prompt) {
        try {
          const response = await fetch('/api/sites', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({
              name: 'My Website',
              initialPrompt: prompt
            })
          });

          if (!response.ok) {
            throw new Error('Failed to create site');
          }

          const data = await response.json();
          const siteId = data.site.id;

          // Redirect to builder
          window.location.href = `/sites/${siteId}/builder`;
        } catch (error) {
          console.error('[Landing] Error creating site:', error);
          authCodeError.textContent = 'Failed to create site. Please try again.';
          authCodeError.classList.add('show');
        }
      }

      // Initialize on load
      init();
    })();
