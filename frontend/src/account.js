// frontend/src/account.js
class AccountManager {
    constructor() {
        this.accountBtn = null;
        this.tabButtons = null;
        this.tabContents = null;
        this.init();
    }

    init() {
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setup());
        } else {
            this.setup();
        }
    }

    setup() {
        this.insertAccountButton();
        this.setupTabElements();
        this.setupEventListeners();
    }

    insertAccountButton() {
        const logoutBtn = document.querySelector('.logout-btn');
        if (logoutBtn) {
            const accountBtn = document.createElement('button');
            accountBtn.className = 'account-btn';
            accountBtn.textContent = 'Account';
            logoutBtn.parentNode.insertBefore(accountBtn, logoutBtn);
            this.accountBtn = accountBtn;
        }
    }

    setupTabElements() {
        this.tabButtons = document.querySelectorAll('.tab-button');
        this.tabContents = document.querySelectorAll('.tab-content');
    }

    setupEventListeners() {
        // Tab switching
        this.tabButtons?.forEach(button => {
            button.addEventListener('click', () => this.switchTab(button.dataset.tab));
        });
    }

    switchTab(tabId) {
        if (!this.tabButtons || !this.tabContents) return;

        // Remove active class from all buttons and contents
        this.tabButtons.forEach(btn => btn.classList.remove('active'));
        this.tabContents.forEach(content => content.classList.remove('active'));

        // Add active class to selected button and content
        const selectedButton = Array.from(this.tabButtons).find(btn => btn.dataset.tab === tabId);
        const selectedContent = Array.from(this.tabContents).find(content => content.id === tabId);

        if (selectedButton && selectedContent) {
            selectedButton.classList.add('active');
            selectedContent.classList.add('active');
        }
    }
}

// Initialize the account manager
new AccountManager();
