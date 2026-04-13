/**
 * Auth Pages JavaScript - CSP compliant external script
 * Handles magic link authentication flow
 */

(function() {
  'use strict';

  // Wait for DOM to be ready
  document.addEventListener('DOMContentLoaded', function() {
    // Add viewport meta if not present
    if (!document.querySelector('meta[name="viewport"]')) {
      var meta = document.createElement('meta');
      meta.name = 'viewport';
      meta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
      document.head.appendChild(meta);
    }

    // Initialize magic link auth if elements exist
    initMagicLinkAuth();
  });

  function initMagicLinkAuth() {
    var sendCodeBtn = document.getElementById('send-magic-code-btn');
    var verifyCodeBtn = document.getElementById('verify-magic-code-btn');
    var resendCodeBtn = document.getElementById('resend-code-btn');
    var changeEmailBtn = document.getElementById('change-email-btn');
    var emailInput = document.getElementById('magic-email');
    var codeInput = document.getElementById('magic-code');
    var emailStep = document.getElementById('magic-link-email-step');
    var codeStep = document.getElementById('magic-link-code-step');
    var emailDisplay = document.getElementById('magic-email-display');

    // Exit if elements don't exist (not on login page)
    if (!sendCodeBtn || !emailInput) {
      return;
    }

    var currentEmail = '';

    // Send code button click
    sendCodeBtn.addEventListener('click', function() {
      var email = emailInput.value.trim();

      if (!email || !email.includes('@')) {
        showError('Please enter a valid email address');
        return;
      }

      sendCodeBtn.disabled = true;
      sendCodeBtn.textContent = 'Sending...';
      hideMessages();

      fetch('/auth/magic-link/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email })
      })
      .then(function(response) {
        return response.json();
      })
      .then(function(data) {
        if (data.success) {
          currentEmail = email;
          if (emailDisplay) {
            emailDisplay.textContent = email;
          }
          emailStep.classList.add('hide');
          codeStep.classList.add('show');
          if (codeInput) {
            codeInput.focus();
          }
        } else {
          showError(data.error || 'Failed to send code');
        }
        sendCodeBtn.disabled = false;
        sendCodeBtn.textContent = 'Send Verification Code';
      })
      .catch(function(error) {
        console.error('Magic link request error:', error);
        showError('Network error. Please try again.');
        sendCodeBtn.disabled = false;
        sendCodeBtn.textContent = 'Send Verification Code';
      });
    });

    // Verify code button click
    if (verifyCodeBtn) {
      verifyCodeBtn.addEventListener('click', function() {
        var code = codeInput.value.trim();

        if (code.length !== 6 || !/^\d{6}$/.test(code)) {
          showVerifyError('Please enter a valid 6-digit code');
          return;
        }

        verifyCodeBtn.disabled = true;
        verifyCodeBtn.textContent = 'Verifying...';
        hideMessages();

        fetch('/auth/magic-link/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: currentEmail, code: code })
        })
        .then(function(response) {
          return response.json();
        })
        .then(function(data) {
          if (data.success) {
            if (data.requiresMfa) {
              window.location.href = data.redirect || '/auth/mfa-verify';
            } else {
              window.location.href = data.redirect || '/';
            }
          } else {
            showVerifyError(data.error || 'Invalid code');
            verifyCodeBtn.disabled = false;
            verifyCodeBtn.textContent = 'Verify Code';
          }
        })
        .catch(function(error) {
          console.error('Magic link verify error:', error);
          showVerifyError('Network error. Please try again.');
          verifyCodeBtn.disabled = false;
          verifyCodeBtn.textContent = 'Verify Code';
        });
      });
    }

    // Resend code button click
    if (resendCodeBtn) {
      resendCodeBtn.addEventListener('click', function() {
        if (!currentEmail) return;

        resendCodeBtn.disabled = true;
        resendCodeBtn.textContent = 'Sending...';
        hideMessages();

        fetch('/auth/magic-link/request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: currentEmail })
        })
        .then(function(response) {
          return response.json();
        })
        .then(function(data) {
          if (data.success) {
            showVerifySuccess('New code sent! Check your email.');
            if (codeInput) {
              codeInput.value = '';
              codeInput.focus();
            }
          } else {
            showVerifyError(data.error || 'Failed to send code');
          }
          resendCodeBtn.disabled = false;
          resendCodeBtn.textContent = 'Resend Code';
        })
        .catch(function(error) {
          console.error('Resend code error:', error);
          showVerifyError('Network error. Please try again.');
          resendCodeBtn.disabled = false;
          resendCodeBtn.textContent = 'Resend Code';
        });
      });
    }

    // Change email button click
    if (changeEmailBtn) {
      changeEmailBtn.addEventListener('click', function() {
        codeStep.classList.remove('show');
        emailStep.classList.remove('hide');
        if (codeInput) {
          codeInput.value = '';
        }
        hideMessages();
        emailInput.focus();
      });
    }

    // Enter key handlers
    emailInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        sendCodeBtn.click();
      }
    });

    if (codeInput) {
      codeInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
          verifyCodeBtn.click();
        }
      });

      // Only allow numeric input for code
      codeInput.addEventListener('input', function() {
        this.value = this.value.replace(/[^0-9]/g, '');
      });
    }

    // Helper functions
    function showError(message) {
      var errorEl = document.getElementById('magic-link-error');
      if (errorEl) {
        errorEl.textContent = message;
        errorEl.classList.add('show');
      }
    }

    function showVerifyError(message) {
      var errorEl = document.getElementById('magic-verify-error');
      if (errorEl) {
        errorEl.textContent = message;
        errorEl.classList.add('show');
      }
    }

    function showVerifySuccess(message) {
      var successEl = document.getElementById('magic-verify-success');
      if (successEl) {
        successEl.textContent = message;
        successEl.classList.add('show');
      }
    }

    function hideMessages() {
      var elements = [
        'magic-link-error',
        'magic-link-success',
        'magic-verify-error',
        'magic-verify-success'
      ];
      elements.forEach(function(id) {
        var el = document.getElementById(id);
        if (el) {
          el.classList.remove('show');
        }
      });
    }
  }
})();
