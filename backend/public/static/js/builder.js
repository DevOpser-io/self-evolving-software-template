/**
 * DevOpser Lite Website Builder JavaScript
 * Handles chat, preview rendering, WYSIWYG editing, drag-and-drop, and image management
 */

(function() {
  'use strict';

  // Read server data from JSON data block
  var serverDataEl = document.getElementById('server-data');
  var serverData = serverDataEl ? JSON.parse(serverDataEl.textContent) : {};

  var siteId = serverData.siteId || '';
  var siteData = serverData.siteData || null;

  // DOM Elements
  var chatMessages = document.getElementById('chat-messages');
  var chatInput = document.getElementById('chat-input');
  var sendBtn = document.getElementById('send-btn');
  var publishBtn = document.getElementById('publish-btn');
  var previewFrame = document.getElementById('preview-frame');
  var refreshPreviewBtn = document.getElementById('refresh-preview');

  var chatHistory = [];
  var isProcessing = false;
  var currentPageIndex = 0; // Track current page for multi-page sites

  // Simple markdown formatter for chat messages
  function formatMarkdown(text) {
    if (!text) return '';

    // Escape HTML first
    var html = escapeHtml(text);

    // Code blocks (```)
    html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, '<pre><code>$2</code></pre>');

    // Inline code (`)
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Bold (**text** or __text__)
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/__([^_]+)__/g, '<strong>$1</strong>');

    // Italic (*text* or _text_)
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    html = html.replace(/_([^_]+)_/g, '<em>$1</em>');

    // Headers (## Header)
    html = html.replace(/^### (.+)$/gm, '<h6>$1</h6>');
    html = html.replace(/^## (.+)$/gm, '<h5>$1</h5>');
    html = html.replace(/^# (.+)$/gm, '<h4>$1</h4>');

    // Bullet lists (- item or * item at start of line)
    html = html.replace(/^[\-\*] (.+)$/gm, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');

    // Numbered lists (1. item)
    html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');

    // Line breaks
    html = html.replace(/\n/g, '<br>');

    // Clean up extra breaks around block elements
    html = html.replace(/<br>(<\/?(?:ul|ol|li|h[1-6]|pre|code)>)/g, '$1');
    html = html.replace(/(<\/?(?:ul|ol|li|h[1-6]|pre|code)>)<br>/g, '$1');

    return html;
  }

  // Add message to chat
  function addMessage(role, content) {
    var div = document.createElement('div');
    div.className = 'chat-message ' + role;

    if (role === 'assistant') {
      // Format markdown for assistant messages
      div.innerHTML = formatMarkdown(content);
    } else {
      div.textContent = content;
    }

    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  // Add tools used indicator
  function addToolsUsedMessage(toolNames) {
    var div = document.createElement('div');
    div.className = 'chat-message tools-used';
    div.innerHTML = '<i class="fa-solid fa-screwdriver-wrench me-1"></i> Used: ' + escapeHtml(toolNames);
    chatMessages.appendChild(div);
  }

  // Send chat message
  function sendMessage() {
    var message = chatInput.value.trim();
    if (!message || isProcessing || !siteId) return;

    isProcessing = true;
    sendBtn.disabled = true;
    sendBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Processing...';

    // Add user message to chat
    addMessage('user', message);
    chatInput.value = '';

    // Add to history
    chatHistory.push({ role: 'user', content: message });

    fetch('/api/sites/' + siteId + '/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'same-origin',
      body: JSON.stringify({
        message: message,
        history: chatHistory
      })
    })
    .then(function(response) { return response.json(); })
    .then(function(data) {
      if (data.success) {
        // Show tools used if any
        if (data.toolsUsed && data.toolsUsed.length > 0) {
          var toolNames = data.toolsUsed.map(function(t) { return t.name.replace(/_/g, ' '); }).join(', ');
          addToolsUsedMessage(toolNames);
        }

        // Add AI response to chat
        addMessage('assistant', data.message);
        chatHistory.push({ role: 'assistant', content: data.message });

        // Refresh preview if config changed
        if (data.siteConfig) {
          console.log('[Builder] Refreshing preview with config:', JSON.stringify(data.siteConfig.sections?.find(function(s) { return s.type === 'hero'; })?.content, null, 2));
          refreshPreview(data.siteConfig);
          // Update local siteData
          siteData.draftConfig = data.siteConfig;

          // Show publish button if we now have content
          if (data.siteConfig.sections && data.siteConfig.sections.length > 0) {
            if (!publishBtn) {
              location.reload(); // Reload to show publish button
            }
          }
        }
      } else {
        addMessage('system', 'Error: ' + (data.error || 'Something went wrong'));
      }
    })
    .catch(function(error) {
      console.error('Chat error:', error);
      addMessage('system', 'Error: Failed to send message. Please try again.');
    })
    .finally(function() {
      isProcessing = false;
      sendBtn.disabled = false;
      sendBtn.innerHTML = '<i class="fa-solid fa-paper-plane me-1"></i> Send';
    });
  }

  // Helper to determine if a hex color is dark (for text contrast)
  function isColorDark(hexColor) {
    if (!hexColor || typeof hexColor !== 'string') return false;
    var hex = hexColor.replace('#', '');
    if (hex.length !== 6 && hex.length !== 3) return false;
    var r, g, b;
    if (hex.length === 3) {
      r = parseInt(hex[0] + hex[0], 16);
      g = parseInt(hex[1] + hex[1], 16);
      b = parseInt(hex[2] + hex[2], 16);
    } else {
      r = parseInt(hex.substring(0, 2), 16);
      g = parseInt(hex.substring(2, 4), 16);
      b = parseInt(hex.substring(4, 6), 16);
    }
    var luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance < 0.5;
  }

  // Switch to a different page in multi-page mode
  function switchToPage(pageIndex, config) {
    currentPageIndex = pageIndex;
    refreshPreview(config);
  }

  // Refresh preview with new config
  function refreshPreview(config) {
    console.log('[Builder] refreshPreview called');
    var primaryColor = config.theme?.primaryColor || '#3B82F6';
    var secondaryColor = config.theme?.secondaryColor || '#10B981';
    var siteName = config.siteName || 'My Website';

    var html = '';

    // Render navigation
    html += '<nav class="site-nav">';
    html += '<a href="#" class="site-nav-logo" data-editable data-field="siteName">' + escapeHtml(siteName) + '</a>';
    html += '<ul class="site-nav-links">';

    if (config.navigation && config.navigation.links && config.navigation.links.length > 0) {
      config.navigation.links.forEach(function(link, idx) {
        var isActive = idx === currentPageIndex ? ' class="active"' : '';
        html += '<li><a href="#" data-page-index="' + idx + '"' + isActive + '>' + escapeHtml(link.label) + '</a></li>';
      });
    } else if (config.pages && config.pages.length > 0) {
      // Fallback: generate nav from pages if navigation.links not set
      config.pages.forEach(function(page, idx) {
        var isActive = idx === currentPageIndex ? ' class="active"' : '';
        html += '<li><a href="#" data-page-index="' + idx + '"' + isActive + '>' + escapeHtml(page.name) + '</a></li>';
      });
    } else {
      // Default single "Home" link for legacy configs
      html += '<li><a href="#" class="active">Home</a></li>';
    }

    html += '</ul></nav>';

    html += '<div class="site-preview" id="sitePreviewContent">';

    // Get sections from either multi-page format or legacy format
    var rawSections;
    if (config.pages && config.pages.length > 0) {
      // Multi-page format: get sections from current page
      var safePageIndex = Math.min(currentPageIndex, config.pages.length - 1);
      rawSections = config.pages[safePageIndex]?.sections || [];
    } else {
      // Legacy single-page format
      rawSections = config.sections || [];
    }

    var sections = rawSections
      .filter(function(s) { return s.visible !== false; })
      .sort(function(a, b) { return a.order - b.order; });

    sections.forEach(function(section, sectionIndex) {
      var sectionId = section.id;
      if (section.type === 'hero') {
        // Support custom hero background colors and images
        var heroBgStart = section.content.backgroundColorStart || primaryColor;
        var heroBgEnd = section.content.backgroundColorEnd || secondaryColor;
        var heroImage = section.content.backgroundImage || '';
        var hasCustomBg = section.content.backgroundColorStart || section.content.backgroundColorEnd;
        var isDark = hasCustomBg && (isColorDark(heroBgStart) || isColorDark(heroBgEnd));
        var heroClass = isDark ? 'section-hero dark-bg' : 'section-hero';
        if (heroImage) {
          heroClass += ' has-bg-image';
        }
        console.log('[Builder] Hero rendering:', { heroBgStart: heroBgStart, heroBgEnd: heroBgEnd, hasCustomBg: hasCustomBg, isDark: isDark, heroImage: heroImage });
        // Use data attributes for colors and editing - CSS will be applied via JS after innerHTML
        html += '<div class="' + heroClass + '" data-section-id="' + sectionId + '" data-section-type="hero" data-bg-start="' + heroBgStart + '" data-bg-end="' + heroBgEnd + '" data-bg-image="' + escapeHtml(heroImage) + '">';
        // Hero background image edit button - positioned absolutely in corner
        html += '<button class="hero-bg-edit" data-editable-image data-field="backgroundImage" title="Click to change background image" type="button">';
        html += '<i class="fa-solid fa-image"></i>';
        html += '<span>' + (heroImage ? 'Change Image' : 'Add Image') + '</span>';
        html += '</button>';
        // Hero content wrapper - separate from edit controls
        html += '<div class="hero-content">';
        html += '<h1 data-editable data-field="headline">' + escapeHtml(section.content.headline || '') + '</h1>';
        html += '<p data-editable data-field="subheadline">' + escapeHtml(section.content.subheadline || '') + '</p>';
        if (section.content.ctaText) {
          var ctaBtnClass = isDark ? 'cta-btn cta-btn-white' : 'cta-btn';
          html += '<a href="' + escapeHtml(section.content.ctaLink || '#') + '" class="' + ctaBtnClass + '" data-editable-link data-field="ctaText" data-link-field="ctaLink">' + escapeHtml(section.content.ctaText) + '</a>';
        }
        html += '</div>'; // Close hero-content
        html += '</div>';
      } else if (section.type === 'features') {
        html += '<div class="section-features" data-section-id="' + sectionId + '" data-section-type="features">';
        html += '<h2 data-editable data-field="title">' + escapeHtml(section.content.title || '') + '</h2>';
        html += '<div class="features-grid">';
        (section.content.items || []).forEach(function(item, itemIndex) {
          var iconName = item.icon || 'star';
          html += '<div class="feature-item" data-item-index="' + itemIndex + '">';
          html += '<div class="feature-icon" data-editable-icon data-field="items.' + itemIndex + '.icon" data-current-icon="' + escapeHtml(iconName) + '"><i class="fa-solid fa-' + escapeHtml(iconName) + '"></i></div>';
          html += '<h3 data-editable data-field="items.' + itemIndex + '.title">' + escapeHtml(item.title || '') + '</h3>';
          html += '<p data-editable data-field="items.' + itemIndex + '.description">' + escapeHtml(item.description || '') + '</p>';
          html += '</div>';
        });
        html += '</div></div>';
      } else if (section.type === 'about') {
        html += '<div class="section-about" data-section-id="' + sectionId + '" data-section-type="about">';
        html += '<h2 data-editable data-field="title">' + escapeHtml(section.content.title || '') + '</h2>';
        html += '<p data-editable data-field="content">' + escapeHtml(section.content.content || '') + '</p>';
        html += '</div>';
      } else if (section.type === 'testimonials') {
        html += '<div class="section-testimonials" data-section-id="' + sectionId + '" data-section-type="testimonials">';
        html += '<h2 data-editable data-field="title">' + escapeHtml(section.content.title || 'Testimonials') + '</h2>';
        html += '<div class="testimonials-grid">';
        (section.content.items || []).forEach(function(item, itemIndex) {
          html += '<div class="testimonial-item" data-item-index="' + itemIndex + '">';
          html += '<p class="testimonial-quote" data-editable data-field="items.' + itemIndex + '.quote">"' + escapeHtml(item.quote || '') + '"</p>';
          html += '<p class="testimonial-author" data-editable data-field="items.' + itemIndex + '.author">' + escapeHtml(item.author || '') + '</p>';
          if (item.role) {
            html += '<p class="testimonial-role" data-editable data-field="items.' + itemIndex + '.role">' + escapeHtml(item.role) + '</p>';
          }
          html += '</div>';
        });
        html += '</div></div>';
      } else if (section.type === 'pricing') {
        html += '<div class="section-pricing" data-section-id="' + sectionId + '" data-section-type="pricing">';
        html += '<h2 data-editable data-field="title">' + escapeHtml(section.content.title || 'Pricing') + '</h2>';
        if (section.content.subtitle) {
          html += '<p class="pricing-subtitle" data-editable data-field="subtitle">' + escapeHtml(section.content.subtitle) + '</p>';
        }
        html += '<div class="pricing-grid">';
        (section.content.items || []).forEach(function(item, itemIndex) {
          var itemClass = item.highlighted ? 'pricing-item highlighted' : 'pricing-item';
          html += '<div class="' + itemClass + '" data-item-index="' + itemIndex + '">';
          html += '<p class="pricing-name" data-editable data-field="items.' + itemIndex + '.name">' + escapeHtml(item.name || '') + '</p>';
          html += '<p><span class="pricing-price" data-editable data-field="items.' + itemIndex + '.price">' + escapeHtml(item.price || '') + '</span>';
          if (item.period) {
            html += '<span class="pricing-period">' + escapeHtml(item.period) + '</span>';
          }
          html += '</p>';
          if (item.features && item.features.length > 0) {
            html += '<ul class="pricing-features" data-editable-list data-field="items.' + itemIndex + '.features">';
            item.features.forEach(function(feature, featureIndex) {
              html += '<li data-editable-list-item data-list-index="' + featureIndex + '">' + escapeHtml(feature) + '</li>';
            });
            html += '</ul>';
          }
          if (item.ctaText) {
            html += '<a href="' + escapeHtml(item.ctaLink || '#') + '" class="pricing-cta" data-editable-link data-field="items.' + itemIndex + '.ctaText" data-link-field="items.' + itemIndex + '.ctaLink">' + escapeHtml(item.ctaText) + '</a>';
          }
          html += '</div>';
        });
        html += '</div></div>';
      } else if (section.type === 'contact') {
        html += '<div class="section-contact" data-section-id="' + sectionId + '" data-section-type="contact">';
        html += '<h2 data-editable data-field="title">' + escapeHtml(section.content.title || '') + '</h2>';
        html += '<p data-editable data-field="subtitle">' + escapeHtml(section.content.subtitle || '') + '</p>';
        if (section.content.email) {
          html += '<p><i class="fa-solid fa-envelope me-2"></i><span data-editable data-field="email">' + escapeHtml(section.content.email) + '</span></p>';
        }
        html += '</div>';
      } else if (section.type === 'team') {
        html += '<div class="section-team" data-section-id="' + sectionId + '" data-section-type="team">';
        html += '<h2 data-editable data-field="title">' + escapeHtml(section.content.title || 'Meet Our Team') + '</h2>';
        if (section.content.subtitle) {
          html += '<p class="team-subtitle" data-editable data-field="subtitle">' + escapeHtml(section.content.subtitle) + '</p>';
        }
        html += '<div class="team-grid">';
        (section.content.members || []).forEach(function(member, memberIndex) {
          html += '<div class="team-member" data-item-index="' + memberIndex + '">';
          html += '<div class="team-member-photo" data-editable-image data-field="members.' + memberIndex + '.photo">';
          if (member.photo) {
            html += '<img src="' + escapeHtml(member.photo) + '" alt="' + escapeHtml(member.name) + '">';
          } else {
            html += '<i class="fa-solid fa-user"></i>';
          }
          html += '</div>';
          html += '<h3 data-editable data-field="members.' + memberIndex + '.name">' + escapeHtml(member.name || '') + '</h3>';
          html += '<p class="role" data-editable data-field="members.' + memberIndex + '.role">' + escapeHtml(member.role || '') + '</p>';
          if (member.bio) {
            html += '<p class="bio" data-editable data-field="members.' + memberIndex + '.bio">' + escapeHtml(member.bio) + '</p>';
          }
          html += '</div>';
        });
        html += '</div></div>';
      } else if (section.type === 'services') {
        html += '<div class="section-services" data-section-id="' + sectionId + '" data-section-type="services">';
        html += '<h2 data-editable data-field="title">' + escapeHtml(section.content.title || 'Our Services') + '</h2>';
        if (section.content.subtitle) {
          html += '<p class="services-subtitle" data-editable data-field="subtitle">' + escapeHtml(section.content.subtitle) + '</p>';
        }
        html += '<div class="services-grid">';
        (section.content.items || []).forEach(function(item, itemIndex) {
          html += '<div class="service-card" data-item-index="' + itemIndex + '">';
          if (item.icon) {
            html += '<div class="service-icon" data-editable-icon data-field="items.' + itemIndex + '.icon" data-current-icon="' + escapeHtml(item.icon) + '"><i class="fa-solid fa-' + escapeHtml(item.icon) + '"></i></div>';
          }
          html += '<h3 data-editable data-field="items.' + itemIndex + '.title">' + escapeHtml(item.title || '') + '</h3>';
          html += '<p class="description" data-editable data-field="items.' + itemIndex + '.description">' + escapeHtml(item.description || '') + '</p>';
          if (item.price) {
            html += '<p class="price" data-editable data-field="items.' + itemIndex + '.price">' + escapeHtml(item.price) + '</p>';
          }
          if (item.ctaText) {
            html += '<a href="' + escapeHtml(item.ctaLink || '#') + '" class="service-cta" data-editable-link data-field="items.' + itemIndex + '.ctaText" data-link-field="items.' + itemIndex + '.ctaLink">' + escapeHtml(item.ctaText) + '</a>';
          }
          html += '</div>';
        });
        html += '</div></div>';
      } else if (section.type === 'story') {
        var imagePos = section.content.imagePosition || 'right';
        var containerClass = imagePos === 'left' ? 'story-container image-left' : 'story-container';
        html += '<div class="section-story" data-section-id="' + sectionId + '" data-section-type="story">';
        html += '<div class="' + containerClass + '">';
        html += '<div class="story-content">';
        html += '<h2 data-editable data-field="title">' + escapeHtml(section.content.title || 'Our Story') + '</h2>';
        html += '<div class="story-text" data-editable data-field="content">' + (section.content.content || '') + '</div>';
        if (section.content.highlights && section.content.highlights.length > 0) {
          html += '<div class="story-highlights">';
          section.content.highlights.forEach(function(highlight, hIndex) {
            html += '<div class="story-highlight">';
            html += '<div class="value" data-editable data-field="highlights.' + hIndex + '.value">' + escapeHtml(highlight.value || '') + '</div>';
            html += '<div class="label" data-editable data-field="highlights.' + hIndex + '.label">' + escapeHtml(highlight.label || '') + '</div>';
            html += '</div>';
          });
          html += '</div>';
        }
        html += '</div>';
        html += '<div class="story-image" data-editable-image data-field="image">';
        if (section.content.image) {
          html += '<img src="' + escapeHtml(section.content.image) + '" alt="' + escapeHtml(section.content.title || 'Our Story') + '">';
        } else {
          html += '<i class="fa-solid fa-image"></i>';
        }
        html += '</div>';
        html += '</div></div>';
      } else if (section.type === 'gallery') {
        var cols = section.content.columns || 3;
        html += '<div class="section-gallery" data-section-id="' + sectionId + '" data-section-type="gallery">';
        if (section.content.title) {
          html += '<h2 data-editable data-field="title">' + escapeHtml(section.content.title) + '</h2>';
        }
        if (section.content.subtitle) {
          html += '<p class="gallery-subtitle" data-editable data-field="subtitle">' + escapeHtml(section.content.subtitle) + '</p>';
        }
        html += '<div class="gallery-grid cols-' + cols + '">';
        (section.content.images || []).forEach(function(image, imgIndex) {
          html += '<div class="gallery-item" data-item-index="' + imgIndex + '" data-editable-image data-field="images.' + imgIndex + '.url">';
          if (image.url) {
            html += '<img src="' + escapeHtml(image.url) + '" alt="' + escapeHtml(image.alt || image.caption || '') + '">';
            if (image.caption) {
              html += '<div class="caption">' + escapeHtml(image.caption) + '</div>';
            }
          } else {
            html += '<div class="placeholder"><i class="fa-solid fa-image"></i></div>';
          }
          html += '</div>';
        });
        html += '</div></div>';
      } else if (section.type === 'contactForm') {
        html += '<div class="section-contactForm" data-section-id="' + sectionId + '" data-section-type="contactForm">';
        html += '<div class="contactForm-container">';
        html += '<div class="contactForm-content">';
        html += '<h2 data-editable data-field="title">' + escapeHtml(section.content.title || 'Get in Touch') + '</h2>';
        if (section.content.subtitle) {
          html += '<p class="form-subtitle" data-editable data-field="subtitle">' + escapeHtml(section.content.subtitle) + '</p>';
        }
        if (section.content.contactInfo) {
          var info = section.content.contactInfo;
          html += '<div class="contactForm-info">';
          if (info.email) {
            html += '<div class="info-item"><i class="fa-solid fa-envelope"></i><span data-editable data-field="contactInfo.email">' + escapeHtml(info.email) + '</span></div>';
          }
          if (info.phone) {
            html += '<div class="info-item"><i class="fa-solid fa-phone"></i><span data-editable data-field="contactInfo.phone">' + escapeHtml(info.phone) + '</span></div>';
          }
          if (info.address) {
            html += '<div class="info-item"><i class="fa-solid fa-location-dot"></i><span data-editable data-field="contactInfo.address">' + escapeHtml(info.address) + '</span></div>';
          }
          if (info.hours) {
            html += '<div class="info-item"><i class="fa-solid fa-clock"></i><span data-editable data-field="contactInfo.hours">' + escapeHtml(info.hours) + '</span></div>';
          }
          html += '</div>';
        }
        html += '</div>';
        html += '<div class="contact-form">';
        (section.content.fields || []).forEach(function(field) {
          html += '<div class="form-group">';
          html += '<label>' + escapeHtml(field.label || field.name) + (field.required ? ' *' : '') + '</label>';
          if (field.type === 'textarea') {
            html += '<textarea name="' + escapeHtml(field.name) + '" placeholder="' + escapeHtml(field.placeholder || '') + '"' + (field.required ? ' required' : '') + '></textarea>';
          } else if (field.type === 'select' && field.options) {
            html += '<select name="' + escapeHtml(field.name) + '"' + (field.required ? ' required' : '') + '>';
            html += '<option value="">' + escapeHtml(field.placeholder || 'Select...') + '</option>';
            field.options.forEach(function(opt) {
              html += '<option value="' + escapeHtml(opt) + '">' + escapeHtml(opt) + '</option>';
            });
            html += '</select>';
          } else {
            html += '<input type="' + escapeHtml(field.type || 'text') + '" name="' + escapeHtml(field.name) + '" placeholder="' + escapeHtml(field.placeholder || '') + '"' + (field.required ? ' required' : '') + '>';
          }
          html += '</div>';
        });
        html += '<button type="submit" class="submit-btn">' + escapeHtml(section.content.submitButtonText || 'Send Message') + '</button>';
        html += '</div>';
        html += '</div></div>';
      } else if (section.type === 'footer') {
        var copyright = section.content.copyright || ('© ' + new Date().getFullYear() + ' ' + (section.content.companyName || config.siteName || ''));
        html += '<div class="section-footer" data-section-id="' + sectionId + '" data-section-type="footer">';
        html += '<p data-editable data-field="copyright">' + escapeHtml(copyright) + '</p>';
        html += '</div>';
      }
    });

    html += '</div>';

    if (sections.length > 0) {
      previewFrame.innerHTML = html;

      // Apply dynamic styles via CSS custom properties
      applyDynamicStyles(config);

      // Initialize editable elements
      initEditableElements();
    } else {
      previewFrame.innerHTML = '<div class="empty-state"><i class="fa-solid fa-palette"></i><h5>No preview yet</h5><p>Describe your website in the chat to get started!</p></div>';
    }
  }

  // Apply dynamic styles via CSS custom properties (CSP-compliant)
  function applyDynamicStyles(config) {
    var primaryColor = config.theme?.primaryColor || '#3B82F6';
    var secondaryColor = config.theme?.secondaryColor || '#10B981';

    // Set CSS custom properties on the preview container
    var previewContent = document.getElementById('sitePreviewContent');
    if (previewContent) {
      previewContent.style.setProperty('--primary-color', primaryColor);
      previewContent.style.setProperty('--secondary-color', secondaryColor);
    }

    // Apply hero background via CSS custom property
    var heroEl = previewFrame.querySelector('.section-hero');
    if (heroEl) {
      var bgStart = heroEl.getAttribute('data-bg-start');
      var bgEnd = heroEl.getAttribute('data-bg-end');
      var bgImage = heroEl.getAttribute('data-bg-image');
      if (bgStart && bgEnd) {
        heroEl.style.setProperty('--hero-bg-start', bgStart);
        heroEl.style.setProperty('--hero-bg-end', bgEnd);
        heroEl.classList.add('has-custom-bg');
      }
      // Apply background image if set
      if (bgImage) {
        heroEl.style.setProperty('--hero-bg-image', 'url(' + bgImage + ')');
        heroEl.classList.add('has-bg-image');
      }
    }
  }

  // ============================================
  // WYSIWYG INLINE EDITING
  // ============================================

  var currentEditElement = null;
  var currentLinkElement = null;
  var originalContent = '';

  // Initialize editable elements with event listeners
  function initEditableElements() {
    // Navigation page links
    var navLinks = previewFrame.querySelectorAll('.site-nav-links a[data-page-index]');
    navLinks.forEach(function(link) {
      link.addEventListener('click', function(e) {
        e.preventDefault();
        var pageIndex = parseInt(link.getAttribute('data-page-index'));
        if (!isNaN(pageIndex) && siteData && siteData.draftConfig) {
          switchToPage(pageIndex, siteData.draftConfig);
        }
      });
    });

    // Text editable elements
    var editables = previewFrame.querySelectorAll('[data-editable]');
    editables.forEach(function(el) {
      el.addEventListener('click', handleEditableClick);
      el.addEventListener('blur', handleEditableBlur);
      el.addEventListener('keydown', handleEditableKeydown);
    });

    // Link/button editable elements
    var links = previewFrame.querySelectorAll('[data-editable-link]');
    links.forEach(function(el) {
      el.addEventListener('click', handleLinkClick);
    });

    // Icon editable elements
    var icons = previewFrame.querySelectorAll('[data-editable-icon]');
    icons.forEach(function(el) {
      el.addEventListener('click', handleIconClick);
    });

    // Editable list items (pricing features, etc.)
    var listItems = previewFrame.querySelectorAll('[data-editable-list-item]');
    listItems.forEach(function(el) {
      el.addEventListener('click', handleListItemClick);
      el.addEventListener('blur', handleListItemBlur);
      el.addEventListener('keydown', handleListItemKeydown);
    });

    // Add delete buttons and add-item buttons to lists
    var lists = previewFrame.querySelectorAll('[data-editable-list]');
    lists.forEach(function(list) {
      initEditableList(list);
    });

    // Initialize icon picker grid
    initIconPicker();

    // Initialize drag and drop for section reordering
    initDragAndDrop();

    // Initialize editable images
    initEditableImages();
  }

  // Handle click on editable text element
  function handleEditableClick(e) {
    e.preventDefault();
    e.stopPropagation();

    var el = e.target;
    if (el.getAttribute('contenteditable') === 'true') return;

    // Store original content for cancel
    originalContent = el.textContent;
    currentEditElement = el;

    // Make editable
    el.setAttribute('contenteditable', 'true');
    el.focus();

    // Select all text
    var range = document.createRange();
    range.selectNodeContents(el);
    var sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }

  // Handle blur (save changes)
  function handleEditableBlur(e) {
    var el = e.target;
    if (el.getAttribute('contenteditable') !== 'true') return;

    el.setAttribute('contenteditable', 'false');

    var newContent = el.textContent.trim();
    if (newContent !== originalContent) {
      saveTextEdit(el, newContent);
    }

    currentEditElement = null;
    originalContent = '';
  }

  // Handle keydown (Enter to save, Escape to cancel)
  function handleEditableKeydown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      e.target.blur();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.target.textContent = originalContent;
      e.target.blur();
    }
  }

  // ============================================
  // LIST ITEM EDITING (Pricing features, etc.)
  // ============================================

  var currentListItem = null;
  var originalListContent = '';

  // Initialize an editable list with delete buttons and add button
  function initEditableList(list) {
    // Add delete buttons to each item
    var items = list.querySelectorAll('[data-editable-list-item]');
    items.forEach(function(item) {
      if (!item.querySelector('.list-item-delete')) {
        var deleteBtn = document.createElement('button');
        deleteBtn.className = 'list-item-delete';
        deleteBtn.innerHTML = '×';
        deleteBtn.title = 'Delete this item';
        deleteBtn.onclick = function(e) {
          e.stopPropagation();
          deleteListItem(item);
        };
        item.appendChild(deleteBtn);
      }
    });

    // Add "add item" button if not present
    if (!list.querySelector('.list-add-item')) {
      var addBtn = document.createElement('button');
      addBtn.className = 'list-add-item';
      addBtn.innerHTML = '+ Add item';
      addBtn.onclick = function(e) {
        e.stopPropagation();
        addListItem(list);
      };
      list.appendChild(addBtn);
    }
  }

  // Handle click on list item
  function handleListItemClick(e) {
    e.preventDefault();
    e.stopPropagation();

    var el = e.target.closest('[data-editable-list-item]');
    if (!el || el.getAttribute('contenteditable') === 'true') return;

    // Store original content for cancel
    originalListContent = el.textContent.replace('×', '').trim();
    currentListItem = el;

    // Make editable
    el.setAttribute('contenteditable', 'true');
    el.classList.add('editing');
    el.focus();

    // Select all text (excluding the delete button)
    var range = document.createRange();
    var textNode = el.firstChild;
    if (textNode && textNode.nodeType === Node.TEXT_NODE) {
      range.selectNodeContents(textNode);
      var sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    }
  }

  // Handle blur on list item
  function handleListItemBlur(e) {
    var el = e.target.closest('[data-editable-list-item]');
    if (!el || el.getAttribute('contenteditable') !== 'true') return;

    el.setAttribute('contenteditable', 'false');
    el.classList.remove('editing');

    // Get text content excluding delete button
    var newContent = '';
    el.childNodes.forEach(function(node) {
      if (node.nodeType === Node.TEXT_NODE) {
        newContent += node.textContent;
      }
    });
    newContent = newContent.trim();

    if (newContent !== originalListContent && newContent !== '') {
      saveListItemEdit(el, newContent);
    } else if (newContent === '' && originalListContent !== '') {
      // Restore if emptied
      el.childNodes.forEach(function(node) {
        if (node.nodeType === Node.TEXT_NODE) {
          node.textContent = originalListContent;
        }
      });
    }

    currentListItem = null;
    originalListContent = '';
  }

  // Handle keydown on list item
  function handleListItemKeydown(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.target.blur();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      var el = e.target.closest('[data-editable-list-item]');
      if (el) {
        el.childNodes.forEach(function(node) {
          if (node.nodeType === Node.TEXT_NODE) {
            node.textContent = originalListContent;
          }
        });
        el.blur();
      }
    }
  }

  // Delete a list item
  function deleteListItem(item) {
    var list = item.closest('[data-editable-list]');
    var section = item.closest('[data-section-id]');
    if (!list || !section) return;

    var sectionId = section.getAttribute('data-section-id');
    var field = list.getAttribute('data-field');

    // Get all current items
    var items = list.querySelectorAll('[data-editable-list-item]');
    var newFeatures = [];
    items.forEach(function(li) {
      if (li !== item) {
        var text = '';
        li.childNodes.forEach(function(node) {
          if (node.nodeType === Node.TEXT_NODE) {
            text += node.textContent;
          }
        });
        newFeatures.push(text.trim());
      }
    });

    // Remove the item from DOM
    item.remove();

    // Save to backend
    saveListToBackend(sectionId, field, newFeatures);
  }

  // Add a new list item
  function addListItem(list) {
    var section = list.closest('[data-section-id]');
    if (!section) return;

    var sectionId = section.getAttribute('data-section-id');
    var field = list.getAttribute('data-field');

    // Create new list item
    var items = list.querySelectorAll('[data-editable-list-item]');
    var newIndex = items.length;

    var newItem = document.createElement('li');
    newItem.setAttribute('data-editable-list-item', '');
    newItem.setAttribute('data-list-index', newIndex);
    newItem.textContent = 'New feature';

    // Add delete button
    var deleteBtn = document.createElement('button');
    deleteBtn.className = 'list-item-delete';
    deleteBtn.innerHTML = '×';
    deleteBtn.title = 'Delete this item';
    deleteBtn.onclick = function(e) {
      e.stopPropagation();
      deleteListItem(newItem);
    };
    newItem.appendChild(deleteBtn);

    // Add event listeners
    newItem.addEventListener('click', handleListItemClick);
    newItem.addEventListener('blur', handleListItemBlur);
    newItem.addEventListener('keydown', handleListItemKeydown);

    // Insert before add button
    var addBtn = list.querySelector('.list-add-item');
    list.insertBefore(newItem, addBtn);

    // Get all features and save
    var newFeatures = [];
    list.querySelectorAll('[data-editable-list-item]').forEach(function(li) {
      var text = '';
      li.childNodes.forEach(function(node) {
        if (node.nodeType === Node.TEXT_NODE) {
          text += node.textContent;
        }
      });
      newFeatures.push(text.trim());
    });

    saveListToBackend(sectionId, field, newFeatures);

    // Start editing the new item
    newItem.click();
  }

  // Save list item edit
  function saveListItemEdit(el, newContent) {
    var list = el.closest('[data-editable-list]');
    var section = el.closest('[data-section-id]');
    if (!list || !section) return;

    var sectionId = section.getAttribute('data-section-id');
    var field = list.getAttribute('data-field');

    // Update the text node
    el.childNodes.forEach(function(node) {
      if (node.nodeType === Node.TEXT_NODE) {
        node.textContent = newContent;
      }
    });

    // Get all features
    var features = [];
    list.querySelectorAll('[data-editable-list-item]').forEach(function(li) {
      var text = '';
      li.childNodes.forEach(function(node) {
        if (node.nodeType === Node.TEXT_NODE) {
          text += node.textContent;
        }
      });
      features.push(text.trim());
    });

    saveListToBackend(sectionId, field, features);
  }

  // Save list changes to backend
  function saveListToBackend(sectionId, field, features) {
    // field is like "items.0.features" for pricing
    var parts = field.split('.');
    var currentSections = getCurrentSections();
    var currentSection = currentSections.find(function(s) { return s.id === sectionId; });
    if (!currentSection) return;

    // Navigate to the right place in the config
    if (parts[0] === 'items' && parts.length >= 3) {
      var itemIndex = parseInt(parts[1]);
      var propName = parts[2];
      if (currentSection.content.items && currentSection.content.items[itemIndex]) {
        currentSection.content.items[itemIndex][propName] = features;
      }
    }

    // Save to backend
    fetch('/api/sites/' + siteData.id, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ draftConfig: siteData.draftConfig })
    })
    .then(function(response) { return response.json(); })
    .then(function(data) {
      if (data.success) {
        console.log('[Builder] List saved successfully');
      }
    })
    .catch(function(error) {
      console.error('[Builder] Error saving list:', error);
    });
  }

  // Handle click on link/button element
  function handleLinkClick(e) {
    e.preventDefault();
    e.stopPropagation();

    currentLinkElement = e.target;
    var popup = document.getElementById('linkEditPopup');
    var textInput = document.getElementById('linkEditText');
    var urlInput = document.getElementById('linkEditUrl');

    // Pre-fill with current values
    textInput.value = currentLinkElement.textContent;
    urlInput.value = currentLinkElement.getAttribute('href') || '';

    // Position popup near the element using CSS custom properties (CSP-compliant)
    var rect = currentLinkElement.getBoundingClientRect();
    popup.classList.add('active');
    popup.classList.add('positioned');
    popup.style.setProperty('--popup-top', Math.round(rect.bottom + 10) + 'px');
    popup.style.setProperty('--popup-left', Math.round(Math.max(10, rect.left)) + 'px');

    textInput.focus();
    textInput.select();
  }

  // Save link edit
  function saveLinkEdit() {
    if (!currentLinkElement) return;

    var textInput = document.getElementById('linkEditText');
    var urlInput = document.getElementById('linkEditUrl');
    var newText = textInput.value.trim();
    var newUrl = urlInput.value.trim();

    if (newText) {
      currentLinkElement.textContent = newText;
    }
    if (newUrl) {
      currentLinkElement.setAttribute('href', newUrl);
    }

    // Save to config
    var section = currentLinkElement.closest('[data-section-id]');
    var sectionId = section.getAttribute('data-section-id');
    var textField = currentLinkElement.getAttribute('data-field');
    var linkField = currentLinkElement.getAttribute('data-link-field');

    var updates = {};
    if (newText) updates[textField] = newText;
    if (newUrl) updates[linkField] = newUrl;

    saveToBackend(sectionId, updates);
    closeLinkEdit();
  }

  // Close link edit popup
  function closeLinkEdit() {
    document.getElementById('linkEditPopup').classList.remove('active');
    document.getElementById('linkEditPopup').classList.remove('positioned');
    currentLinkElement = null;
  }

  // Icon picker functionality
  var currentIconElement = null;
  var availableIcons = [
    'rocket', 'star', 'heart', 'check', 'shield', 'bolt',
    'globe', 'users', 'clock', 'chart-bar', 'lock', 'cloud',
    'code', 'phone', 'gear', 'headset', 'book', 'gift',
    'microchip', 'database', 'envelope', 'eye', 'file-lines', 'flag',
    'folder', 'house', 'image', 'key', 'layer-group', 'link',
    'map', 'bullhorn', 'moon', 'palette', 'pencil', 'user',
    'chart-pie', 'location-dot', 'play', 'circle-plus', 'power-off', 'puzzle-piece',
    'magnifying-glass', 'paper-plane', 'share', 'store', 'gauge', 'sun',
    'terminal', 'trophy', 'truck', 'wifi', 'wrench', 'magnifying-glass-plus'
  ];

  // Initialize icon picker grid
  function initIconPicker() {
    var grid = document.getElementById('iconPickerGrid');
    if (!grid) return;

    grid.innerHTML = '';
    availableIcons.forEach(function(icon) {
      var item = document.createElement('div');
      item.className = 'icon-picker-item';
      item.setAttribute('data-icon', icon);
      item.innerHTML = '<i class="fa-solid fa-' + icon + '"></i>';
      item.onclick = function() { selectIcon(icon); };
      grid.appendChild(item);
    });
  }

  // Handle click on editable icon
  function handleIconClick(e) {
    e.preventDefault();
    e.stopPropagation();

    currentIconElement = e.currentTarget;
    var popup = document.getElementById('iconPickerPopup');
    var currentIcon = currentIconElement.getAttribute('data-current-icon') || 'star';

    // Update selected state in grid
    var items = document.querySelectorAll('.icon-picker-item');
    items.forEach(function(item) {
      item.classList.remove('selected');
      if (item.getAttribute('data-icon') === currentIcon) {
        item.classList.add('selected');
      }
    });

    // Position popup near the element using CSS custom properties (CSP-compliant)
    var rect = currentIconElement.getBoundingClientRect();
    popup.classList.add('active');
    popup.classList.add('positioned');
    popup.style.setProperty('--popup-top', Math.round(rect.bottom + 10) + 'px');
    popup.style.setProperty('--popup-left', Math.round(Math.max(10, rect.left - 100)) + 'px');
  }

  // Select icon from picker
  function selectIcon(iconName) {
    if (!currentIconElement) return;

    // Update the icon element
    var iconEl = currentIconElement.querySelector('i');
    if (iconEl) {
      iconEl.className = 'fa-solid fa-' + iconName;
    }
    currentIconElement.setAttribute('data-current-icon', iconName);

    // Save to config
    var section = currentIconElement.closest('[data-section-id]');
    var sectionId = section.getAttribute('data-section-id');
    var field = currentIconElement.getAttribute('data-field');

    // Handle nested field (items.0.icon)
    var parts = field.split('.');
    if (parts[0] === 'items' && parts.length >= 3) {
      var itemIndex = parseInt(parts[1]);
      var currentSections = getCurrentSections();
      var currentSection = currentSections.find(function(s) { return s.id === sectionId; });
      if (currentSection && currentSection.content.items) {
        var items = JSON.parse(JSON.stringify(currentSection.content.items));
        items[itemIndex].icon = iconName;
        saveToBackend(sectionId, { items: items });
      }
    }

    closeIconPicker();
  }

  // Close icon picker popup
  function closeIconPicker() {
    document.getElementById('iconPickerPopup').classList.remove('active');
    document.getElementById('iconPickerPopup').classList.remove('positioned');
    currentIconElement = null;
  }

  // Drag and drop section reordering
  var draggedSection = null;
  var draggedSectionId = null;

  function initDragAndDrop() {
    var sections = previewFrame.querySelectorAll('[data-section-id]');
    sections.forEach(function(section) {
      // Add drag handle if not present
      if (!section.querySelector('.section-drag-handle')) {
        var handle = document.createElement('div');
        handle.className = 'section-drag-handle';
        handle.innerHTML = '<i class="fa-solid fa-grip-vertical"></i>';
        handle.setAttribute('draggable', 'true');
        handle.setAttribute('title', 'Drag to reorder');
        section.appendChild(handle);

        // Add drop indicators
        var topIndicator = document.createElement('div');
        topIndicator.className = 'drop-indicator-top';
        section.appendChild(topIndicator);

        var bottomIndicator = document.createElement('div');
        bottomIndicator.className = 'drop-indicator-bottom';
        section.appendChild(bottomIndicator);
      }

      // Make section draggable via handle
      var handle = section.querySelector('.section-drag-handle');
      handle.addEventListener('dragstart', handleDragStart);
      handle.addEventListener('dragend', handleDragEnd);

      // Section as drop target
      section.addEventListener('dragover', handleDragOver);
      section.addEventListener('dragleave', handleDragLeave);
      section.addEventListener('drop', handleDrop);
    });
  }

  function handleDragStart(e) {
    var section = e.target.closest('[data-section-id]');
    draggedSection = section;
    draggedSectionId = section.getAttribute('data-section-id');

    // Use setTimeout to allow the drag image to be captured first
    setTimeout(function() {
      section.classList.add('dragging');
    }, 0);

    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', draggedSectionId);
  }

  function handleDragEnd(e) {
    if (draggedSection) {
      draggedSection.classList.remove('dragging');
    }

    // Remove all drag-over classes
    var sections = previewFrame.querySelectorAll('[data-section-id]');
    sections.forEach(function(s) {
      s.classList.remove('drag-over', 'drag-over-top', 'drag-over-bottom');
    });

    draggedSection = null;
    draggedSectionId = null;
  }

  function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    var section = e.target.closest('[data-section-id]');
    if (!section || section === draggedSection) return;

    // Determine if we're in the top or bottom half
    var rect = section.getBoundingClientRect();
    var midpoint = rect.top + rect.height / 2;

    // Remove previous indicators
    var sections = previewFrame.querySelectorAll('[data-section-id]');
    sections.forEach(function(s) {
      if (s !== section) {
        s.classList.remove('drag-over-top', 'drag-over-bottom');
      }
    });

    if (e.clientY < midpoint) {
      section.classList.remove('drag-over-bottom');
      section.classList.add('drag-over-top');
    } else {
      section.classList.remove('drag-over-top');
      section.classList.add('drag-over-bottom');
    }
  }

  function handleDragLeave(e) {
    var section = e.target.closest('[data-section-id]');
    if (!section) return;

    // Only remove if we're actually leaving the section
    var rect = section.getBoundingClientRect();
    if (e.clientX < rect.left || e.clientX > rect.right ||
        e.clientY < rect.top || e.clientY > rect.bottom) {
      section.classList.remove('drag-over-top', 'drag-over-bottom');
    }
  }

  function handleDrop(e) {
    e.preventDefault();

    var targetSection = e.target.closest('[data-section-id]');
    if (!targetSection || !draggedSectionId) return;

    var targetSectionId = targetSection.getAttribute('data-section-id');
    if (targetSectionId === draggedSectionId) return;

    // Determine drop position
    var rect = targetSection.getBoundingClientRect();
    var dropBefore = e.clientY < rect.top + rect.height / 2;

    // Reorder sections in config
    reorderSections(draggedSectionId, targetSectionId, dropBefore);

    // Clean up
    targetSection.classList.remove('drag-over-top', 'drag-over-bottom');
  }

  function reorderSections(draggedId, targetId, dropBefore) {
    if (!siteData || !siteData.draftConfig) return;

    // Get the sections array reference (modifiable) based on format
    var sections;
    var config = siteData.draftConfig;
    if (config.pages && config.pages.length > 0) {
      var safePageIndex = Math.min(currentPageIndex, config.pages.length - 1);
      sections = config.pages[safePageIndex]?.sections;
    } else {
      sections = config.sections;
    }
    if (!sections) return;

    // Find indices
    var draggedIndex = sections.findIndex(function(s) { return s.id === draggedId; });
    var targetIndex = sections.findIndex(function(s) { return s.id === targetId; });

    if (draggedIndex === -1 || targetIndex === -1) return;

    // Remove dragged section
    var draggedItem = sections.splice(draggedIndex, 1)[0];

    // Recalculate target index after removal
    if (draggedIndex < targetIndex) {
      targetIndex--;
    }

    // Insert at new position
    var insertIndex = dropBefore ? targetIndex : targetIndex + 1;
    sections.splice(insertIndex, 0, draggedItem);

    // Update order values
    sections.forEach(function(s, i) {
      s.order = i;
    });

    // Save to backend
    saveSectionOrder();

    // Refresh preview
    refreshPreview(siteData.draftConfig);
  }

  function saveSectionOrder() {
    if (!siteData || !siteData.draftConfig) return;

    console.log('[Builder] Saving section order...');
    showSaveIndicator('saving');

    fetch('/api/sites/' + siteId, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ draftConfig: siteData.draftConfig })
    })
    .then(function(response) {
      if (!response.ok) throw new Error('Failed to save');
      return response.json();
    })
    .then(function(data) {
      console.log('[Builder] Section order saved');
      showSaveIndicator('success');
    })
    .catch(function(error) {
      console.error('[Builder] Error saving order:', error);
      showSaveIndicator('error', 'Failed to save order');
    });
  }

  // Helper to get current page's sections (handles both legacy and multi-page formats)
  function getCurrentSections() {
    if (!siteData || !siteData.draftConfig) return [];
    var config = siteData.draftConfig;
    if (config.pages && config.pages.length > 0) {
      var safePageIndex = Math.min(currentPageIndex, config.pages.length - 1);
      return config.pages[safePageIndex]?.sections || [];
    }
    return config.sections || [];
  }

  // Save text edit to config
  function saveTextEdit(el, newContent) {
    var section = el.closest('[data-section-id]');
    if (!section) return;

    var sectionId = section.getAttribute('data-section-id');
    var field = el.getAttribute('data-field');

    var updates = {};

    // Handle nested fields like items.0.title
    if (field.includes('.')) {
      var parts = field.split('.');
      if (parts[0] === 'items') {
        var itemIndex = parseInt(parts[1]);
        var itemField = parts[2];
        // We need to get the full items array and update it
        var currentSections = getCurrentSections();
        var currentSection = currentSections.find(function(s) { return s.id === sectionId; });
        if (currentSection && currentSection.content.items) {
          var items = JSON.parse(JSON.stringify(currentSection.content.items));
          items[itemIndex][itemField] = newContent;
          updates.items = items;
        }
      }
    } else {
      updates[field] = newContent;
    }

    saveToBackend(sectionId, updates);
  }

  // Save changes to backend (immediate - no debounce for reliability)
  var isSaving = false;
  var pendingSave = null;

  function saveToBackend(sectionId, contentUpdates) {
    // Update local config immediately
    var currentSections = getCurrentSections();
    var section = currentSections.find(function(s) { return s.id === sectionId; });
    if (section) {
      Object.assign(section.content, contentUpdates);
    }

    // If already saving, queue this save
    if (isSaving) {
      pendingSave = { sectionId: sectionId, updates: contentUpdates };
      return;
    }

    doSave();
  }

  var currentSaveIndicator = null;

  function doSave() {
    if (!siteData || !siteData.draftConfig) return;

    isSaving = true;
    console.log('[Builder] Saving changes to backend...');

    // Show saving indicator
    showSaveIndicator('saving');

    fetch('/api/sites/' + siteId, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ draftConfig: siteData.draftConfig })
    })
    .then(function(res) { return res.json(); })
    .then(function(data) {
      isSaving = false;
      if (data.success) {
        console.log('[Builder] Save successful');
        showSaveIndicator('success');

        // Process any pending save
        if (pendingSave) {
          var pending = pendingSave;
          pendingSave = null;
          saveToBackend(pending.sectionId, pending.updates);
        }
      } else {
        console.error('[Builder] Save failed:', data.error);
        showSaveIndicator('error', data.error || 'Save failed');
      }
    })
    .catch(function(err) {
      isSaving = false;
      console.error('[Builder] Save error:', err);
      showSaveIndicator('error', 'Connection error');
    });
  }

  // Show save indicator with different states
  function showSaveIndicator(state, message) {
    // Remove existing indicator
    if (currentSaveIndicator) {
      currentSaveIndicator.remove();
      currentSaveIndicator = null;
    }

    var indicator = document.createElement('div');
    indicator.className = 'save-indicator';

    if (state === 'saving') {
      indicator.classList.add('saving');
      indicator.innerHTML = '<div class="save-spinner"></div> Saving...';
    } else if (state === 'success') {
      indicator.innerHTML = '<i class="fa-solid fa-circle-check"></i> Saved';
      setTimeout(function() {
        if (indicator.parentNode) indicator.remove();
        currentSaveIndicator = null;
      }, 2000);
    } else if (state === 'error') {
      indicator.classList.add('error');
      indicator.innerHTML = '<i class="fa-solid fa-circle-xmark"></i> ' + (message || 'Error');
      setTimeout(function() {
        if (indicator.parentNode) indicator.remove();
        currentSaveIndicator = null;
      }, 3000);
    }

    document.body.appendChild(indicator);
    currentSaveIndicator = indicator;
  }

  // ============================================
  // END WYSIWYG
  // ============================================

  // Escape HTML
  function escapeHtml(str) {
    if (!str) return '';
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // Deployment status polling
  var deploymentPollTimer = null;
  var deploymentPollCount = 0;
  var maxPollAttempts = 40; // 40 * 15s = 10 minutes max

  function checkDeploymentStatus(isManual) {
    if (isManual) {
      addMessage('system', 'Checking deployment status...');
    }

    fetch('/api/sites/' + siteId + '/status', {
      credentials: 'same-origin',
      headers: { 'Accept': 'application/json' }
    })
    .then(function(response) { return response.json(); })
    .then(function(data) {
      if (!data.success) {
        if (isManual) addMessage('system', 'Error checking status: ' + (data.error || 'Unknown error'));
        return;
      }

      var status = data.status;

      if (status.isComplete) {
        // Deployment successful!
        stopDeploymentPolling();
        showDeploymentSuccess(status);
      } else if (status.isFailed) {
        // Deployment failed
        stopDeploymentPolling();
        showDeploymentError(status.error || 'Deployment failed');
      } else if (status.isDeploying) {
        // Still deploying - update UI
        updateDeploymentProgress(status.deploymentStatus);
        if (isManual) {
          addMessage('system', 'Deployment in progress: ' + formatDeploymentStatus(status.deploymentStatus));
        }
      } else if (isManual) {
        addMessage('system', 'Status: ' + status.siteStatus + ' / ' + status.deploymentStatus);
      }
    })
    .catch(function(error) {
      console.error('Status check error:', error);
      if (isManual) addMessage('system', 'Error checking status. Please try again.');
    });
  }

  function formatDeploymentStatus(status) {
    var statusMap = {
      'pending': 'Preparing deployment...',
      'creating_service': 'Creating container service (this takes 2-3 minutes)...',
      'deploying': 'Deploying your site...',
      'active': 'Deployment complete!'
    };
    return statusMap[status] || status;
  }

  function startDeploymentPolling() {
    deploymentPollCount = 0;
    // Wait 30 seconds before first poll (service creation takes time)
    addMessage('system', 'Deployment started! Creating your site infrastructure...');
    publishBtn.disabled = true;
    publishBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Deploying...';
    showCheckStatusButton();

    setTimeout(function() {
      // First check after 30s
      checkDeploymentStatus(false);
      // Then poll every 15 seconds
      deploymentPollTimer = setInterval(function() {
        deploymentPollCount++;
        if (deploymentPollCount >= maxPollAttempts) {
          stopDeploymentPolling();
          addMessage('system', 'Deployment is taking longer than expected. Use "Check Status" button to manually check.');
          return;
        }
        checkDeploymentStatus(false);
      }, 15000);
    }, 30000);
  }

  function stopDeploymentPolling() {
    if (deploymentPollTimer) {
      clearInterval(deploymentPollTimer);
      deploymentPollTimer = null;
    }
  }

  function showDeploymentSuccess(status) {
    var siteUrl = 'https://' + siteData.slug + '.example.com';
    var lightsailUrl = status.lightsailUrl;

    publishBtn.disabled = false;
    publishBtn.innerHTML = '<i class="fa-solid fa-rocket me-1"></i> Publish';
    hideCheckStatusButton();

    // Show success message with link
    var successHtml = 'Your site is now live! <a href="' + (lightsailUrl || siteUrl) + '" target="_blank" class="text-success"><strong>View your site</strong></a>';
    var msgDiv = document.createElement('div');
    msgDiv.className = 'chat-message system deployment-success';
    msgDiv.innerHTML = '<i class="fa-solid fa-circle-check text-success me-2"></i>' + successHtml;
    chatMessages.appendChild(msgDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    // Show prominent site URL banner
    showSiteUrlBanner(lightsailUrl || siteUrl);
  }

  function showDeploymentError(errorMsg) {
    publishBtn.disabled = false;
    publishBtn.innerHTML = '<i class="fa-solid fa-rocket me-1"></i> Publish';
    hideCheckStatusButton();
    addMessage('system', 'Deployment failed: ' + errorMsg);
  }

  function updateDeploymentProgress(status) {
    publishBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> ' + formatDeploymentStatus(status);
  }

  function showCheckStatusButton() {
    var existingBtn = document.getElementById('check-status-btn');
    if (existingBtn) return;

    var btn = document.createElement('button');
    btn.id = 'check-status-btn';
    btn.className = 'btn btn-outline-secondary btn-sm ms-2';
    btn.innerHTML = '<i class="fa-solid fa-refresh me-1"></i> Check Status';
    btn.onclick = function() { checkDeploymentStatus(true); };
    publishBtn.parentNode.appendChild(btn);
  }

  function hideCheckStatusButton() {
    var btn = document.getElementById('check-status-btn');
    if (btn) btn.remove();
  }

  function showSiteUrlBanner(url) {
    var existingBanner = document.getElementById('site-url-banner');
    if (existingBanner) existingBanner.remove();

    var banner = document.createElement('div');
    banner.id = 'site-url-banner';
    banner.className = 'alert alert-success d-flex align-items-center justify-content-between mt-3';
    banner.innerHTML = '<div><i class="fa-solid fa-globe me-2"></i><strong>Your site is live:</strong> <a href="' + url + '" target="_blank">' + url + '</a></div>' +
      '<a href="' + url + '" target="_blank" class="btn btn-success btn-sm"><i class="fa-solid fa-external-link me-1"></i>Open Site</a>';

    // Insert at top of chat area
    var chatContainer = chatMessages.parentNode;
    chatContainer.insertBefore(banner, chatContainer.firstChild);
  }

  // Publish site
  function publishSite() {
    if (!siteId || isProcessing) return;

    if (!confirm('Ready to publish your site? It will be live at ' + siteData.slug + '.example.com')) {
      return;
    }

    publishBtn.disabled = true;
    publishBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Starting...';

    fetch('/api/sites/' + siteId + '/publish', {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Accept': 'application/json'
      }
    })
    .then(function(response) {
      if (!response.ok) {
        return response.text().then(function(text) {
          try {
            return JSON.parse(text);
          } catch (e) {
            throw new Error('Server error: ' + response.status);
          }
        });
      }
      return response.json();
    })
    .then(function(data) {
      if (data.success) {
        startDeploymentPolling();
      } else {
        addMessage('system', 'Error: ' + (data.error || 'Failed to publish'));
        publishBtn.disabled = false;
        publishBtn.innerHTML = '<i class="fa-solid fa-rocket me-1"></i> Publish';
      }
    })
    .catch(function(error) {
      console.error('Publish error:', error);
      addMessage('system', 'Error: Failed to publish. Please try again.');
      publishBtn.disabled = false;
      publishBtn.innerHTML = '<i class="fa-solid fa-rocket me-1"></i> Publish';
    });
  }

  // Check if we should resume polling on page load (site is deploying)
  function checkInitialDeploymentStatus() {
    if (siteData && ['pending', 'creating_service', 'deploying'].includes(siteData.deploymentStatus)) {
      // Site is currently deploying, resume polling
      addMessage('system', 'Deployment in progress: ' + formatDeploymentStatus(siteData.deploymentStatus));
      publishBtn.disabled = true;
      publishBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> ' + formatDeploymentStatus(siteData.deploymentStatus);
      showCheckStatusButton();
      // Start polling immediately since deployment is already in progress
      deploymentPollTimer = setInterval(function() {
        deploymentPollCount++;
        if (deploymentPollCount >= maxPollAttempts) {
          stopDeploymentPolling();
          return;
        }
        checkDeploymentStatus(false);
      }, 15000);
      // Check once immediately
      setTimeout(function() { checkDeploymentStatus(false); }, 2000);
    } else if (siteData && siteData.status === 'published' && siteData.lightsailUrl) {
      // Site is already published, show the URL
      showSiteUrlBanner(siteData.lightsailUrl);
    }
  }

  // ============================================
  // IMAGE PICKER FUNCTIONALITY
  // ============================================

  var imagePickerModal = document.getElementById('imagePickerModal');
  var closeImagePickerBtn = document.getElementById('closeImagePicker');
  var imageUploadZone = document.getElementById('imageUploadZone');
  var imageFileInput = document.getElementById('imageFileInput');
  var siteImagesGrid = document.getElementById('siteImagesGrid');
  var noImagesMessage = document.getElementById('noImagesMessage');
  var uploadProgress = document.getElementById('uploadProgress');
  var currentImageElement = null;
  var currentImageField = null;
  var siteImages = [];

  // Open image picker
  function openImagePicker(element, field) {
    currentImageElement = element;
    currentImageField = field;
    imagePickerModal.classList.add('active');
    loadSiteImages();
  }

  // Close image picker
  function closeImagePickerModal() {
    imagePickerModal.classList.remove('active');
    currentImageElement = null;
    currentImageField = null;
  }

  // Load site images
  function loadSiteImages() {
    if (!siteId) return;

    fetch('/api/sites/' + siteId + '/images', {
      credentials: 'same-origin'
    })
    .then(function(response) { return response.json(); })
    .then(function(data) {
      if (data.success) {
        siteImages = data.images || [];
        renderSiteImages();
      }
    })
    .catch(function(error) {
      console.error('Error loading images:', error);
    });
  }

  // Render site images grid
  function renderSiteImages() {
    siteImagesGrid.innerHTML = '';

    if (siteImages.length === 0) {
      noImagesMessage.classList.add('visible');
      return;
    }

    noImagesMessage.classList.remove('visible');

    siteImages.forEach(function(image) {
      var item = document.createElement('div');
      item.className = 'site-image-item';
      item.innerHTML = '<img src="' + escapeHtml(image.url) + '" alt="Site image">';
      item.addEventListener('click', function() {
        selectImage(image.url);
      });
      siteImagesGrid.appendChild(item);
    });
  }

  // Select an image
  function selectImage(url) {
    if (!currentImageElement || !currentImageField) return;

    // Check if this is a hero background image
    var isHeroBackground = currentImageField === 'backgroundImage' &&
                           currentImageElement.classList.contains('hero-bg-edit');

    if (isHeroBackground) {
      // For hero background, apply CSS background-image to the section
      var heroSection = currentImageElement.closest('.section-hero');
      if (heroSection) {
        heroSection.style.setProperty('--hero-bg-image', 'url(' + url + ')');
        heroSection.classList.add('has-bg-image');
        heroSection.setAttribute('data-bg-image', url);
        // Update button text
        var spanEl = currentImageElement.querySelector('span');
        if (spanEl) {
          spanEl.textContent = 'Change Image';
        }
      }
    } else {
      // For other images (team photos, gallery, etc.), update the img element
      var img = currentImageElement.querySelector('img');
      var icon = currentImageElement.querySelector('i');

      if (img) {
        img.src = url;
      } else if (icon) {
        // Replace icon with image
        currentImageElement.innerHTML = '<img src="' + escapeHtml(url) + '" alt="Image">';
      }
    }

    // Update the config
    updateConfigField(currentImageField, url);

    closeImagePickerModal();
  }

  // Upload image
  function uploadImage(file) {
    if (!siteId) return;

    var formData = new FormData();
    formData.append('image', file);

    uploadProgress.classList.add('visible');
    var progressBar = uploadProgress.querySelector('.progress-bar');
    progressBar.classList.add('progress-30');

    fetch('/api/sites/' + siteId + '/images/upload', {
      method: 'POST',
      credentials: 'same-origin',
      body: formData
    })
    .then(function(response) {
      progressBar.classList.remove('progress-30');
      progressBar.classList.add('progress-100');
      return response.json();
    })
    .then(function(data) {
      if (data.success) {
        siteImages.unshift(data.image);
        renderSiteImages();
        // Auto-select the uploaded image
        selectImage(data.image.url);
      } else {
        alert('Upload failed: ' + (data.error || 'Unknown error'));
      }
    })
    .catch(function(error) {
      console.error('Upload error:', error);
      alert('Upload failed: ' + error.message);
    })
    .finally(function() {
      setTimeout(function() {
        uploadProgress.classList.remove('visible');
        progressBar.classList.remove('progress-30', 'progress-100');
      }, 500);
    });
  }

  // Update config field for images
  function updateConfigField(fieldPath, value) {
    if (!siteData || !siteData.draftConfig) return;

    var sectionEl = currentImageElement.closest('[data-section-id]');
    if (!sectionEl) return;

    var sectionId = sectionEl.getAttribute('data-section-id');
    var currentSections = getCurrentSections();
    var section = currentSections.find(function(s) { return s.id === sectionId; });
    if (!section) return;

    // Parse the field path and set the value
    var parts = fieldPath.split('.');
    var obj = section.content;

    for (var i = 0; i < parts.length - 1; i++) {
      var part = parts[i];
      var indexMatch = part.match(/^(\w+)\.(\d+)$/);
      if (indexMatch) {
        obj = obj[indexMatch[1]][parseInt(indexMatch[2])];
      } else if (!isNaN(parseInt(part))) {
        obj = obj[parseInt(part)];
      } else {
        if (!obj[part]) obj[part] = {};
        obj = obj[part];
      }
    }

    var lastPart = parts[parts.length - 1];
    obj[lastPart] = value;

    // Save to server
    saveConfig();
  }

  // Save config to server
  function saveConfig() {
    if (!siteData || !siteData.draftConfig) return;

    fetch('/api/sites/' + siteId, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ draftConfig: siteData.draftConfig })
    })
    .then(function(response) { return response.json(); })
    .then(function(data) {
      if (data.success) {
        showSaveIndicator('success');
      } else {
        showSaveIndicator('error', data.error);
      }
    })
    .catch(function(error) {
      console.error('Save error:', error);
      showSaveIndicator('error', 'Connection error');
    });
  }

  // Handle clicks on editable image elements
  function handleImageClick(e) {
    e.preventDefault();
    e.stopPropagation();
    var el = e.target.closest('[data-editable-image]');
    if (el) {
      var field = el.getAttribute('data-field');
      openImagePicker(el, field);
    }
  }

  // Initialize editable image elements
  function initEditableImages() {
    var imageElements = previewFrame.querySelectorAll('[data-editable-image]');
    imageElements.forEach(function(el) {
      el.addEventListener('click', handleImageClick);
      el.classList.add('editable-image');
    });
  }

  // ============================================
  // EVENT LISTENERS AND INITIALIZATION
  // ============================================

  // Initialize link edit popup buttons
  var linkEditSaveBtn = document.getElementById('linkEditSaveBtn');
  var linkEditCancelBtn = document.getElementById('linkEditCancelBtn');

  if (linkEditSaveBtn) {
    linkEditSaveBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      saveLinkEdit();
    });
  }

  if (linkEditCancelBtn) {
    linkEditCancelBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      closeLinkEdit();
    });
  }

  // Close popups when clicking outside
  document.addEventListener('click', function(e) {
    var linkPopup = document.getElementById('linkEditPopup');
    var iconPopup = document.getElementById('iconPickerPopup');

    if (linkPopup && linkPopup.classList.contains('active') && !linkPopup.contains(e.target) && !e.target.hasAttribute('data-editable-link')) {
      closeLinkEdit();
    }
    if (iconPopup && iconPopup.classList.contains('active') && !iconPopup.contains(e.target) && !e.target.closest('[data-editable-icon]')) {
      closeIconPicker();
    }
  });

  // Event listeners for image picker
  if (closeImagePickerBtn) {
    closeImagePickerBtn.addEventListener('click', closeImagePickerModal);
  }

  if (imagePickerModal) {
    imagePickerModal.addEventListener('click', function(e) {
      if (e.target === imagePickerModal) {
        closeImagePickerModal();
      }
    });
  }

  if (imageUploadZone) {
    imageUploadZone.addEventListener('click', function() {
      imageFileInput.click();
    });

    imageUploadZone.addEventListener('dragover', function(e) {
      e.preventDefault();
      imageUploadZone.classList.add('dragover');
    });

    imageUploadZone.addEventListener('dragleave', function() {
      imageUploadZone.classList.remove('dragover');
    });

    imageUploadZone.addEventListener('drop', function(e) {
      e.preventDefault();
      imageUploadZone.classList.remove('dragover');
      var files = e.dataTransfer.files;
      if (files.length > 0) {
        uploadImage(files[0]);
      }
    });
  }

  if (imageFileInput) {
    imageFileInput.addEventListener('change', function() {
      if (this.files.length > 0) {
        uploadImage(this.files[0]);
      }
    });
  }

  // Main event listeners
  if (sendBtn) {
    sendBtn.addEventListener('click', sendMessage);
  }

  if (chatInput) {
    chatInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
  }

  if (publishBtn) {
    publishBtn.addEventListener('click', publishSite);
  }

  if (refreshPreviewBtn) {
    refreshPreviewBtn.addEventListener('click', function() {
      if (siteData && siteData.draftConfig) {
        refreshPreview(siteData.draftConfig);
      }
    });
  }

  // Delete site (in status dropdown)
  var deleteSiteBtn = document.getElementById('delete-site-btn');
  if (deleteSiteBtn) {
    deleteSiteBtn.addEventListener('click', function() {
      var siteName = siteData ? siteData.name : 'this site';
      var confirmMsg = 'Are you sure you want to delete "' + siteName + '"?\n\nThis action cannot be undone. All site data will be permanently deleted.';

      if (!confirm(confirmMsg)) {
        return;
      }

      // Double confirm for safety
      var confirmAgain = prompt('Type "DELETE" to confirm deletion of "' + siteName + '":');
      if (confirmAgain !== 'DELETE') {
        alert('Deletion cancelled. You must type DELETE to confirm.');
        return;
      }

      deleteSiteBtn.disabled = true;
      deleteSiteBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Deleting...';

      fetch('/api/sites/' + siteId, {
        method: 'DELETE',
        credentials: 'same-origin'
      })
      .then(function(response) { return response.json(); })
      .then(function(data) {
        if (data.success) {
          alert('Site deleted successfully.');
          window.location.href = '/sites';
        } else {
          alert('Error: ' + (data.error || 'Failed to delete site'));
          deleteSiteBtn.disabled = false;
          deleteSiteBtn.innerHTML = '<i class="fa-solid fa-trash me-1"></i> Delete Site';
        }
      })
      .catch(function(error) {
        console.error('Delete error:', error);
        alert('Error: Failed to delete site. Please try again.');
        deleteSiteBtn.disabled = false;
        deleteSiteBtn.innerHTML = '<i class="fa-solid fa-trash me-1"></i> Delete Site';
      });
    });
  }

  // Apply theme colors to server-rendered preview (if exists)
  function applyInitialThemeColors() {
    if (!siteData || !siteData.draftConfig) return;

    var config = siteData.draftConfig;
    var primaryColor = config.theme?.primaryColor || '#3B82F6';
    var secondaryColor = config.theme?.secondaryColor || '#10B981';

    // Apply to existing server-rendered preview
    var sitePreview = document.getElementById('site-preview');
    if (sitePreview) {
      sitePreview.style.setProperty('--primary-color', primaryColor);
      sitePreview.style.setProperty('--secondary-color', secondaryColor);
    }

    // Apply hero background if exists
    var heroEl = document.querySelector('.section-hero[data-bg-start][data-bg-end]');
    if (heroEl) {
      var bgStart = heroEl.getAttribute('data-bg-start');
      var bgEnd = heroEl.getAttribute('data-bg-end');
      if (bgStart && bgEnd) {
        heroEl.style.setProperty('--hero-bg-start', bgStart);
        heroEl.style.setProperty('--hero-bg-end', bgEnd);
        heroEl.classList.add('has-custom-bg');
      }
    }
  }

  // Initialize on page load
  applyInitialThemeColors();

  if (siteData && siteData.draftConfig) {
    refreshPreview(siteData.draftConfig);
  }

  // Check if deployment is in progress and resume polling
  checkInitialDeploymentStatus();

  // Focus chat input on load
  if (chatInput) {
    chatInput.focus();
  }

  // ===========================================
  // Sidebar Tabs
  // ===========================================

  var sidebarTabs = document.querySelectorAll('.sidebar-tab');
  var sidebarPanels = document.querySelectorAll('.sidebar-panel');

  sidebarTabs.forEach(function(tab) {
    tab.addEventListener('click', function() {
      var targetTab = this.getAttribute('data-tab');

      // Update tab states
      sidebarTabs.forEach(function(t) {
        t.classList.remove('active');
      });
      this.classList.add('active');

      // Update panel states
      sidebarPanels.forEach(function(p) {
        p.classList.remove('active');
      });
      var targetPanel = document.getElementById('panel-' + targetTab);
      if (targetPanel) {
        targetPanel.classList.add('active');
      }

      // Load leads when switching to leads tab
      if (targetTab === 'leads') {
        loadLeads();
        loadLeadStats();
      }
    });
  });

  // ===========================================
  // Leads Management
  // ===========================================

  var leadsList = document.getElementById('leads-list');
  var leadsStatusFilter = document.getElementById('leads-status-filter');
  var refreshLeadsBtn = document.getElementById('refresh-leads');
  var leadsCountBadge = document.getElementById('leads-count-badge');
  var currentLeads = [];

  function loadLeads() {
    if (!siteId || !leadsList) return;

    var status = leadsStatusFilter ? leadsStatusFilter.value : '';

    leadsList.innerHTML = '<div class="leads-loading"><i class="fa-solid fa-spinner fa-spin"></i> Loading leads...</div>';

    var url = '/api/leads/site/' + siteId;
    if (status) {
      url += '?status=' + encodeURIComponent(status);
    }

    fetch(url, { credentials: 'same-origin' })
      .then(function(response) { return response.json(); })
      .then(function(data) {
        currentLeads = data.leads || [];
        renderLeadsList();
      })
      .catch(function(error) {
        console.error('Error loading leads:', error);
        leadsList.innerHTML = '<div class="leads-empty"><i class="fa-solid fa-exclamation-circle"></i> Failed to load leads</div>';
      });
  }

  function loadLeadStats() {
    if (!siteId) return;

    fetch('/api/leads/stats/' + siteId, { credentials: 'same-origin' })
      .then(function(response) { return response.json(); })
      .then(function(data) {
        var statTotal = document.getElementById('stat-total');
        var statNew = document.getElementById('stat-new');
        var statRecent = document.getElementById('stat-recent');

        if (statTotal) statTotal.textContent = data.total || 0;
        if (statNew) statNew.textContent = data.byStatus?.new || 0;
        if (statRecent) statRecent.textContent = data.recentCount || 0;

        // Update badge
        var newCount = data.byStatus?.new || 0;
        if (leadsCountBadge) {
          if (newCount > 0) {
            leadsCountBadge.textContent = newCount;
            leadsCountBadge.classList.remove('hidden');
          } else {
            leadsCountBadge.classList.add('hidden');
          }
        }
      })
      .catch(function(error) {
        console.error('Error loading lead stats:', error);
      });
  }

  function renderLeadsList() {
    if (!leadsList) return;

    if (!currentLeads || currentLeads.length === 0) {
      leadsList.innerHTML = '<div class="leads-empty"><i class="fa-solid fa-inbox"></i> No leads yet<br><small>Leads will appear here when someone submits your contact form</small></div>';
      return;
    }

    var html = '';
    currentLeads.forEach(function(lead) {
      var name = lead.form_data?.name || lead.form_data?.Name || 'Unknown';
      var email = lead.form_data?.email || lead.form_data?.Email || '';
      var date = new Date(lead.submitted_at).toLocaleDateString();

      html += '<div class="lead-item" data-lead-id="' + lead.id + '">';
      html += '<div class="lead-item-header">';
      html += '<div>';
      html += '<div class="lead-item-name">' + escapeHtml(name) + '</div>';
      if (email) {
        html += '<div class="lead-item-email">' + escapeHtml(email) + '</div>';
      }
      html += '</div>';
      html += '<span class="lead-status-badge lead-status-' + lead.status + '">' + lead.status + '</span>';
      html += '</div>';
      html += '<div class="lead-item-date">' + date + '</div>';
      html += '</div>';
    });

    leadsList.innerHTML = html;

    // Add click handlers
    var leadItems = leadsList.querySelectorAll('.lead-item');
    leadItems.forEach(function(item) {
      item.addEventListener('click', function() {
        var leadId = this.getAttribute('data-lead-id');
        showLeadDetail(leadId);
      });
    });
  }

  function showLeadDetail(leadId) {
    var lead = currentLeads.find(function(l) { return String(l.id) === String(leadId); });
    if (!lead) return;

    // Create or get modal
    var overlay = document.getElementById('lead-detail-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'lead-detail-overlay';
      overlay.className = 'lead-detail-overlay';
      document.body.appendChild(overlay);
    }

    var name = lead.form_data?.name || lead.form_data?.Name || 'Lead Details';

    var html = '<div class="lead-detail-modal">';
    html += '<div class="lead-detail-header">';
    html += '<h5>' + escapeHtml(name) + '</h5>';
    html += '<button class="btn btn-sm btn-outline-secondary close-lead-detail"><i class="fa-solid fa-times"></i></button>';
    html += '</div>';
    html += '<div class="lead-detail-body">';

    // Show all form fields
    if (lead.form_data) {
      for (var key in lead.form_data) {
        if (lead.form_data.hasOwnProperty(key)) {
          html += '<div class="lead-detail-field">';
          html += '<label>' + escapeHtml(key) + '</label>';
          html += '<div class="value">' + escapeHtml(String(lead.form_data[key])) + '</div>';
          html += '</div>';
        }
      }
    }

    // Metadata
    html += '<div class="lead-detail-field">';
    html += '<label>Submitted</label>';
    html += '<div class="value">' + new Date(lead.submitted_at).toLocaleString() + '</div>';
    html += '</div>';

    html += '<div class="lead-detail-field">';
    html += '<label>Status</label>';
    html += '<select class="form-select form-select-sm lead-status-select" data-lead-id="' + lead.id + '">';
    ['new', 'contacted', 'qualified', 'converted', 'archived'].forEach(function(status) {
      html += '<option value="' + status + '"' + (lead.status === status ? ' selected' : '') + '>' + status.charAt(0).toUpperCase() + status.slice(1) + '</option>';
    });
    html += '</select>';
    html += '</div>';

    html += '</div>'; // body
    html += '<div class="lead-detail-footer">';
    html += '<button class="btn btn-outline-danger btn-sm delete-lead-btn" data-lead-id="' + lead.id + '"><i class="fa-solid fa-trash me-1"></i> Delete</button>';
    html += '<button class="btn btn-primary btn-sm ms-auto close-lead-detail">Close</button>';
    html += '</div>';
    html += '</div>'; // modal

    overlay.innerHTML = html;
    overlay.classList.add('active');

    // Close handlers
    overlay.querySelectorAll('.close-lead-detail').forEach(function(btn) {
      btn.addEventListener('click', function() {
        overlay.classList.remove('active');
      });
    });

    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) {
        overlay.classList.remove('active');
      }
    });

    // Status change handler
    var statusSelect = overlay.querySelector('.lead-status-select');
    if (statusSelect) {
      statusSelect.addEventListener('change', function() {
        var newStatus = this.value;
        updateLeadStatus(lead.id, newStatus);
      });
    }

    // Delete handler
    var deleteBtn = overlay.querySelector('.delete-lead-btn');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', function() {
        if (confirm('Are you sure you want to delete this lead?')) {
          deleteLead(lead.id);
          overlay.classList.remove('active');
        }
      });
    }
  }

  function updateLeadStatus(leadId, status) {
    fetch('/api/leads/' + leadId, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ status: status })
    })
      .then(function(response) { return response.json(); })
      .then(function(data) {
        if (data.id) {
          // Update local data
          var lead = currentLeads.find(function(l) { return l.id === leadId; });
          if (lead) lead.status = status;
          renderLeadsList();
          loadLeadStats();
        }
      })
      .catch(function(error) {
        console.error('Error updating lead:', error);
        alert('Failed to update lead status');
      });
  }

  function deleteLead(leadId) {
    fetch('/api/leads/' + leadId, {
      method: 'DELETE',
      credentials: 'same-origin'
    })
      .then(function(response) { return response.json(); })
      .then(function(data) {
        if (data.success) {
          currentLeads = currentLeads.filter(function(l) { return l.id !== leadId; });
          renderLeadsList();
          loadLeadStats();
        }
      })
      .catch(function(error) {
        console.error('Error deleting lead:', error);
        alert('Failed to delete lead');
      });
  }

  // Filter change handler
  if (leadsStatusFilter) {
    leadsStatusFilter.addEventListener('change', function() {
      loadLeads();
    });
  }

  // Refresh button
  if (refreshLeadsBtn) {
    refreshLeadsBtn.addEventListener('click', function() {
      loadLeads();
      loadLeadStats();
    });
  }

  // ===========================================
  // Settings Management
  // ===========================================

  var autoresponderEnabled = document.getElementById('autoresponder-enabled');
  var autoresponderFields = document.getElementById('autoresponder-fields');
  var saveSettingsBtn = document.getElementById('save-settings-btn');

  // Toggle autoresponder fields visibility
  if (autoresponderEnabled && autoresponderFields) {
    autoresponderEnabled.addEventListener('change', function() {
      if (this.checked) {
        autoresponderFields.classList.remove('hidden');
      } else {
        autoresponderFields.classList.add('hidden');
      }
    });
  }

  // Save settings
  if (saveSettingsBtn) {
    saveSettingsBtn.addEventListener('click', function() {
      if (!siteId) return;

      var leadNotificationEnabled = document.getElementById('lead-notification-enabled');
      var autoresponderSubject = document.getElementById('autoresponder-subject');
      var autoresponderBody = document.getElementById('autoresponder-body');
      var leadReplyTo = document.getElementById('lead-reply-to');

      var settings = {
        leadNotificationEnabled: leadNotificationEnabled ? leadNotificationEnabled.checked : true,
        leadAutoresponderEnabled: autoresponderEnabled ? autoresponderEnabled.checked : false,
        leadAutoresponderSubject: autoresponderSubject ? autoresponderSubject.value : '',
        leadAutoresponderBody: autoresponderBody ? autoresponderBody.value : '',
        leadReplyToEmail: leadReplyTo ? leadReplyTo.value : ''
      };

      saveSettingsBtn.disabled = true;
      saveSettingsBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Saving...';

      fetch('/api/sites/' + siteId + '/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(settings)
      })
        .then(function(response) { return response.json(); })
        .then(function(data) {
          if (data.success) {
            saveSettingsBtn.innerHTML = '<i class="fa-solid fa-check me-1"></i> Saved!';
            setTimeout(function() {
              saveSettingsBtn.innerHTML = '<i class="fa-solid fa-save me-1"></i> Save Settings';
              saveSettingsBtn.disabled = false;
            }, 2000);
          } else {
            throw new Error(data.error || 'Failed to save settings');
          }
        })
        .catch(function(error) {
          console.error('Error saving settings:', error);
          alert('Failed to save settings: ' + error.message);
          saveSettingsBtn.innerHTML = '<i class="fa-solid fa-save me-1"></i> Save Settings';
          saveSettingsBtn.disabled = false;
        });
    });
  }

  // Load initial lead stats (for badge)
  if (siteId) {
    loadLeadStats();
  }

})();
