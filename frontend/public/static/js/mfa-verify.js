// MFA verification page JavaScript functionality
document.addEventListener('DOMContentLoaded', function() {
    // Tab switching functionality
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');
    
    // Flash message handling
    function showFlash(message, type) {
        const flashContainer = document.getElementById('flash-messages');
        const flashDiv = document.createElement('div');
        flashDiv.className = `flash ${type}`;
        flashDiv.innerHTML = `${message}<button type="button" class="close-button" aria-label="Dismiss">×</button>`;
        flashContainer.appendChild(flashDiv);
        
        // Add close button functionality
        flashDiv.querySelector('.close-button').addEventListener('click', function() {
            flashDiv.remove();
        });
        
        // Auto-dismiss after 5 seconds
        setTimeout(() => {
            if (flashDiv.parentNode) {
                flashDiv.remove();
            }
        }, 5000);
    }
    
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabName = button.getAttribute('data-tab');
            
            // Update active tab button
            tabButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            
            // Show selected tab content
            tabContents.forEach(content => {
                if (content.id === tabName + '-tab') {
                    content.setAttribute('aria-hidden', 'false');
                    content.classList.add('active');
                } else {
                    content.setAttribute('aria-hidden', 'true');
                    content.classList.remove('active');
                }
            });
        });
    });
    
    // Email code sending functionality
    const emailCodeForm = document.querySelector('.email-code-form');
    if (emailCodeForm) {
        emailCodeForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const button = this.querySelector('button');
            const loadingText = button.getAttribute('data-loading-text') || 'Sending...';
            const originalText = button.textContent;
            const statusContainer = this.closest('.email-info').querySelector('.status-messages');
            
            button.textContent = loadingText;
            button.disabled = true;
            
            fetch('/auth/send-mfa-code', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'CSRF-Token': this.querySelector('input[name="_csrf"]').value
                },
                body: JSON.stringify({
                    _csrf: this.querySelector('input[name="_csrf"]').value
                })
            })
            .then(response => response.json())
            .then(data => {
                const statusMessage = document.createElement('div');
                statusMessage.classList.add('status-message');
                
                if (data.success) {
                    statusMessage.classList.add('success');
                    statusMessage.textContent = 'Verification code sent to your email';
                } else {
                    statusMessage.classList.add('error');
                    statusMessage.textContent = data.message || 'Failed to send verification code';
                }
                
                statusContainer.innerHTML = '';
                statusContainer.appendChild(statusMessage);
            })
            .catch(error => {
                const statusMessage = document.createElement('div');
                statusMessage.classList.add('status-message', 'error');
                statusMessage.textContent = 'An error occurred. Please try again.';
                
                statusContainer.innerHTML = '';
                statusContainer.appendChild(statusMessage);
            })
            .finally(() => {
                button.textContent = originalText;
                button.disabled = false;
            });
        });
    }
});
