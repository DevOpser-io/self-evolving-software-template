// Check if authentication is successful or MFA is required
const urlParams = new URLSearchParams(window.location.search);

if (urlParams.get('mfa_required') === 'true') {
    // MFA is required
    const sessionId = urlParams.get('sessionId');

    document.getElementById('authContent').innerHTML = `
        <div class="success-message">
            🔐 MFA Required<br>
            Please enter your verification code.
        </div>
    `;

    // Notify parent window if in iframe
    if (window.parent !== window) {
        window.parent.postMessage({
            type: 'auth-success',
            mfaRequired: true,
            sessionId: sessionId
        }, '*');
    }

    // Auto-close after 1 second
    setTimeout(() => {
        window.close();
    }, 1000);
} else if (urlParams.get('success') === 'true') {
    document.getElementById('authContent').innerHTML = `
        <div class="success-message">
            ✓ Authentication successful!<br>
            You can now close this window and return to the app.
        </div>
    `;

    // Notify parent window if in iframe
    if (window.parent !== window) {
        window.parent.postMessage({ type: 'auth-success' }, '*');
    }

    // Auto-close after 2 seconds
    setTimeout(() => {
        window.close();
    }, 2000);
}

// Handle login form submission
const loginForm = document.getElementById('loginForm');
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const email = loginForm.querySelector('[name="email"]').value;
        const password = loginForm.querySelector('[name="password"]').value;

        try {
            const response = await fetch('/mobile/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (data.mfaRequired) {
                // Redirect to show MFA requirement
                window.location.href = `/mobile-auth.html?mfa_required=true&sessionId=${data.sessionId}`;
            } else if (data.success && data.authenticated) {
                // Redirect to show success
                window.location.href = '/mobile-auth.html?success=true';
            } else {
                // Show error
                alert(data.error || 'Login failed. Please try again.');
            }
        } catch (error) {
            console.error('Login error:', error);
            alert('An error occurred. Please try again.');
        }
    });
}
