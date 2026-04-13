// Navbar debug script - CSP compliant (uses CSS classes instead of inline styles)
console.log('=== NAVBAR DEBUG SCRIPT STARTED ===');

// Flag to prevent multiple executions
window.navbarDebugExecuted = window.navbarDebugExecuted || false;

function debugNavbar() {
  if (window.navbarDebugExecuted) {
    console.log('Navbar debug already executed, skipping...');
    return;
  }
  console.log('=== NAVBAR DEBUG FUNCTION ===');
  console.log('Window width:', window.innerWidth);

  var togglers = document.querySelectorAll('.navbar-toggler');
  console.log('Found navbar-togglers:', togglers.length);

  togglers.forEach(function(toggler, i) {
    console.log('Toggler ' + i + ':', toggler);
    console.log('  - Display:', getComputedStyle(toggler).display);
    console.log('  - Visibility:', getComputedStyle(toggler).visibility);

    // Force it visible using CSS class
    toggler.classList.add('force-visible');

    // Style the navbar-toggler-icon using CSS class
    var togglerIcon = toggler.querySelector('.navbar-toggler-icon');
    if (togglerIcon) {
      togglerIcon.classList.add('force-styled');
      console.log('  - Styled navbar-toggler-icon');
    }

    // Connect hamburger menu to sidebar toggle functionality
    var sidebar = document.querySelector('.sidebar');
    if (sidebar && sidebar.querySelector('.sidebar-content')) {
      // If we have a proper sidebar with content, remove Bootstrap data attributes and add our own handler
      toggler.removeAttribute('data-bs-toggle');
      toggler.removeAttribute('data-bs-target');

      // Add navigation items to the sidebar content area ONCE during setup
      var sidebarContent = sidebar.querySelector('.sidebar-content');
      if (sidebarContent && !sidebarContent.querySelector('.mobile-nav-section') && !sidebar.hasAttribute('data-nav-setup')) {
        var navbarCollapse = document.querySelector('#navbarNav');

        // Create the navigation section
        var mobileNavSection = document.createElement('div');
        mobileNavSection.className = 'mobile-nav-section hidden';

        // Show/hide based on screen size
        function updateMobileNavVisibility() {
          if (window.innerWidth <= 768) {
            mobileNavSection.classList.remove('hidden');
            mobileNavSection.classList.add('visible');
          } else {
            mobileNavSection.classList.add('hidden');
            mobileNavSection.classList.remove('visible');
          }
        }

        // Set initial visibility
        updateMobileNavVisibility();

        // Update on window resize
        window.addEventListener('resize', updateMobileNavVisibility);

        // Add divider
        var divider = document.createElement('hr');
        mobileNavSection.appendChild(divider);

        // Add navigation items from the navbar (filter out duplicates)
        var navItems = navbarCollapse ? navbarCollapse.querySelectorAll('.nav-link') : [];
        console.log('Found nav items in navbar:', navItems.length);

        // Create a Map to track unique nav items by href
        var uniqueNavItems = new Map();
        navItems.forEach(function(navItem, index) {
          console.log('Nav item ' + index + ':', navItem.textContent.trim(), navItem.href);
          if (!uniqueNavItems.has(navItem.href)) {
            uniqueNavItems.set(navItem.href, navItem);
          }
        });

        console.log('Unique nav items after deduplication:', uniqueNavItems.size);

        uniqueNavItems.forEach(function(navItem) {
          var navLink = document.createElement('a');
          navLink.href = navItem.href;
          navLink.textContent = navItem.textContent;
          navLink.className = 'nav-link mobile-nav-link';
          mobileNavSection.appendChild(navLink);
        });

        // Append to sidebar content at the bottom
        sidebarContent.appendChild(mobileNavSection);

        // Mark sidebar as having nav setup to prevent duplicates
        sidebar.setAttribute('data-nav-setup', 'true');
        console.log('Added integrated navigation to sidebar');
      }

      // Add close button ONCE during setup
      if (!sidebar.querySelector('.sidebar-close-btn')) {
        var closeButton = document.createElement('button');
        closeButton.className = 'sidebar-close-btn';
        closeButton.innerHTML = '&times;';

        closeButton.addEventListener('click', function(e) {
          e.preventDefault();
          e.stopPropagation();
          sidebar.classList.remove('active');
          sidebar.classList.remove('sidebar-open');
          sidebar.classList.add('sidebar-closed');
          console.log('Sidebar closed via close button');
        });

        sidebar.appendChild(closeButton);

        // Show/hide close button based on screen size
        function updateCloseButtonVisibility() {
          if (window.innerWidth <= 768) {
            closeButton.classList.remove('hidden');
            closeButton.classList.add('visible');
          } else {
            closeButton.classList.add('hidden');
            closeButton.classList.remove('visible');
          }
        }

        // Set initial visibility
        updateCloseButtonVisibility();

        // Update on window resize
        window.addEventListener('resize', updateCloseButtonVisibility);

        console.log('Added close button to sidebar');
      }

      toggler.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        console.log('Hamburger menu clicked - toggling sidebar!');

        var isActive = sidebar.classList.contains('active');

        if (isActive) {
          sidebar.classList.remove('active');
          sidebar.classList.remove('sidebar-open');
          sidebar.classList.add('sidebar-closed');
          console.log('Sidebar closed');
        } else {
          sidebar.classList.add('active');
          sidebar.classList.add('sidebar-open');
          sidebar.classList.remove('sidebar-closed');
          console.log('Sidebar opened');
        }
      });
      console.log('  - Connected toggler to sidebar functionality');
    } else {
      console.log('  - No proper sidebar found, keeping Bootstrap navbar collapse behavior');
      // Ensure Bootstrap data attributes are preserved for pages without sidebar
      toggler.setAttribute('data-bs-toggle', 'collapse');
      toggler.setAttribute('data-bs-target', '#navbarNav');
      toggler.setAttribute('aria-controls', 'navbarNav');
      toggler.setAttribute('aria-expanded', 'false');
      console.log('  - Restored Bootstrap collapse attributes');

      // Style the navbar collapse for better mobile UX on pages without sidebar
      var navbarCollapse = document.querySelector('#navbarNav');
      if (navbarCollapse) {
        // Apply mobile-specific styling via CSS class
        function applyMobileNavbarStyling() {
          if (window.innerWidth <= 768) {
            navbarCollapse.classList.add('mobile-dropdown');
          } else {
            navbarCollapse.classList.remove('mobile-dropdown');
          }
        }

        // Apply initial styling
        applyMobileNavbarStyling();

        // Update on window resize
        window.addEventListener('resize', applyMobileNavbarStyling);

        console.log('  - Set up responsive navbar collapse styling');
      }
    }

    console.log('  - After forcing, display:', getComputedStyle(toggler).display);
  });

  // Set flag to prevent re-execution
  window.navbarDebugExecuted = true;
  console.log('=== NAVBAR DEBUG COMPLETED ===');
}

// Only run once when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', debugNavbar);
} else {
  debugNavbar();
}

console.log('=== NAVBAR DEBUG SCRIPT ENDED ===');
