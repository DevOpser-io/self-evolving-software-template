// frontend/src/mfa.js

export function initMFA() {
    console.log('MFA module loaded');
    initMFASetup();
    initMFAVerify();
}

function initMFASetup() {
    const mfaContainer = document.querySelector('.mfa-container');
    if (!mfaContainer) {
        console.log('No MFA container found on this page');
        return;
    }

    console.log('Initializing MFA setup');
    
    // Initialize toggle key functionality
    const toggleKeyBtn = document.querySelector('.js-toggle-key');
    const secretKeyElem = document.querySelector('.secret-key');
    if (toggleKeyBtn && secretKeyElem) {
        console.log('Setting up toggle key handler');
        toggleKeyBtn.addEventListener('click', () => {
            secretKeyElem.classList.toggle('hidden');
            toggleKeyBtn.textContent = secretKeyElem.classList.contains('hidden') 
                ? "Can't scan? Enter key manually" 
                : 'Hide manual key';
        });
    }

    initMethodSelection();
    initEmailVerification();
}

function initMFAVerify() {
    const mfaContainer = document.querySelector('.mfa-verify-page');
    if (!mfaContainer) {
        console.log('No MFA verify page found');
        return;
    }

    console.log('Initializing MFA verify page');
    initTabs();
    initEmailVerification();
}

function initTabs() {
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');
    
    if (!tabButtons.length || !tabContents.length) {
        console.log('No tab elements found');
        return;
    }

    console.log('Setting up tab handlers');

    // Set initial active tab from URL or default to first tab
    const urlParams = new URLSearchParams(window.location.search);
    const initialTab = urlParams.get('active_tab') || tabButtons[0].getAttribute('data-tab');

    function activateTab(tabId) {
        console.log(`Activating tab: ${tabId}`);
        
        // Update active state on buttons
        tabButtons.forEach(btn => {
            const isActive = btn.getAttribute('data-tab') === tabId;
            btn.classList.toggle('active', isActive);
            btn.setAttribute('aria-selected', isActive);
        });
        
        // Update tab content visibility
        tabContents.forEach(content => {
            const isTarget = content.id === `${tabId}-tab`;
            content.classList.toggle('active', isTarget);
            content.classList.toggle('hidden', !isTarget);
            content.setAttribute('aria-hidden', !isTarget);
        });

        // Update URL without reload
        const currentUrl = new URL(window.location.href);
        currentUrl.searchParams.set('active_tab', tabId);
        window.history.replaceState({}, '', currentUrl);
    }

    // Set up click handlers
    tabButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = button.getAttribute('data-tab');
            activateTab(targetId);
        });
    });

    // Activate initial tab
    activateTab(initialTab);
}

function initMethodSelection() {
    const methodRadios = document.querySelectorAll('input[name="mfa_method"]');
    const authenticatorSection = document.querySelector('.authenticator-section');
    const emailSection = document.querySelector('.email-section');
    const selectedMethodInput = document.querySelector('.selected-method');

    if (!methodRadios.length || !authenticatorSection || !emailSection || !selectedMethodInput) {
        console.log('Missing required elements for method selection');
        return;
    }

    console.log('Setting up method selection handlers');

    function toggleSections() {
        const selectedMethod = document.querySelector('input[name="mfa_method"]:checked').value;
        console.log(`Switching to method: ${selectedMethod}`);
        
        authenticatorSection.classList.toggle('hidden', selectedMethod !== 'authenticator');
        authenticatorSection.classList.toggle('active', selectedMethod === 'authenticator');
        emailSection.classList.toggle('hidden', selectedMethod === 'authenticator');
        emailSection.classList.toggle('active', selectedMethod !== 'authenticator');
        
        selectedMethodInput.value = selectedMethod;
    }

    methodRadios.forEach(radio => {
        radio.addEventListener('change', toggleSections);
    });

    // Initial toggle
    toggleSections();
}

class StatusMessageQueue {
    constructor(container) {
        this.container = container;
        this.messages = [];
        this.render();
    }

    addMessage(message, type = 'info', duration = 5000) {
        const id = Date.now() + Math.random();
        const newMessage = { id, message, type };
        this.messages.push(newMessage);
        this.render();

        if (duration > 0) {
            setTimeout(() => this.removeMessage(id), duration);
        }
        return id;
    }

    removeMessage(id) {
        const index = this.messages.findIndex(m => m.id === id);
        if (index !== -1) {
            this.messages.splice(index, 1);
            this.render();
        }
    }

    clear() {
        this.messages = [];
        this.render();
    }

    render() {
        this.container.innerHTML = '';
        
        if (this.messages.length === 0) {
            this.container.style.display = 'none';
            return;
        }

        this.container.style.display = 'block';
        
        this.messages.forEach(msg => {
            const messageElement = document.createElement('div');
            messageElement.className = `status-message status-message-${msg.type}`;
            messageElement.textContent = msg.message;
            this.container.appendChild(messageElement);
        });
    }
}

function initEmailVerification() {
    const emailForms = document.querySelectorAll('.email-code-form');
    if (!emailForms.length) {
        console.log('No email verification forms found');
        return;
    }

    emailForms.forEach(form => {
        console.log('Setting up email form:', form);
        const button = form.querySelector('button[type="submit"]');
        const statusContainer = form.closest('.email-info')?.querySelector('.status-messages');

        if (!button || !statusContainer) {
            console.log('Missing required elements for email verification', {
                button: !!button,
                statusContainer: !!statusContainer,
                formParent: form.closest('.email-info')
            });
            return;
        }

        const messageQueue = new StatusMessageQueue(statusContainer);
        let isSubmitting = false;

        form.addEventListener('submit', async function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            if (isSubmitting || button.disabled) {
                return;
            }
            
            try {
                console.log('Sending code request');
                isSubmitting = true;
                button.disabled = true;
                button.textContent = button.dataset.loadingText || 'Sending...';
                messageQueue.clear();

                const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content;
                if (!csrfToken) {
                    throw new Error('CSRF token not found');
                }

                const formData = new FormData(form);

                const response = await fetch(form.action, {
                    method: 'POST',
                    headers: {
                        'X-Requested-With': 'XMLHttpRequest',
                        'X-CSRFToken': csrfToken
                    },
                    body: formData
                });

                const data = await response.json();
                console.log('Response:', data);

                if (response.status === 429) {
                    const waitTimeMatch = data.message.match(/\d+/);
                    const waitTime = waitTimeMatch ? parseInt(waitTimeMatch[0]) : 120;
                    messageQueue.addMessage(data.message, 'warning', waitTime * 1000);
                    startCountdown(button, waitTime);
                } else if (response.status === 200 && data.success) {
                    messageQueue.addMessage(data.message, 'success', 5000);
                    startCountdown(button, 120);
                } else {
                    messageQueue.addMessage(data.message, 'error', 5000);
                    button.disabled = false;
                    button.textContent = button.dataset.defaultText || 'Send Code';
                }
            } catch (error) {
                console.error('Error:', error);
                messageQueue.addMessage('An error occurred. Please try again.', 'error', 5000);
                button.disabled = false;
                button.textContent = button.dataset.defaultText || 'Send Code';
            } finally {
                if (!button.hasAttribute('data-countdown')) {
                    isSubmitting = false;
                }
            }
        });

        // Store the original button text
        button.dataset.defaultText = button.textContent;
    });
}

function startCountdown(button, seconds) {
    button.setAttribute('data-countdown', 'true');
    button.disabled = true;
    
    // Clear any existing interval
    if (button._countdownInterval) {
        clearInterval(button._countdownInterval);
    }

    const countdownInterval = setInterval(() => {
        button.textContent = `Wait ${seconds}s`;
        seconds--;

        if (seconds < 0) {
            clearInterval(countdownInterval);
            button.removeAttribute('data-countdown');
            button._countdownInterval = null;
            button.disabled = false;
            button.textContent = 'Send Code';
        }
    }, 1000);

    // Store interval reference
    button._countdownInterval = countdownInterval;
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initMFA);
