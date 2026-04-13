// static/flash.js - Self-executing function to avoid global scope pollution
(function() {
    function initFlashMessages() {
        // Handle manual dismissal via click
        document.addEventListener('click', function(e) {
            if (e.target.matches('.flash .close-button')) {
                const flash = e.target.closest('.flash');
                if (flash) {
                    flash.style.animation = 'slideOut 0.3s ease forwards';
                    setTimeout(() => flash.remove(), 300);
                }
            }
        });

        // Auto-dismiss flashes after 5 seconds
        document.querySelectorAll('.flash').forEach(flash => {
            setTimeout(() => {
                if (flash && flash.parentNode) {
                    flash.style.animation = 'slideOut 0.3s ease forwards';
                    setTimeout(() => flash.remove(), 300);
                }
            }, 5000);
        });
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initFlashMessages);
    } else {
        initFlashMessages();
    }
})();
