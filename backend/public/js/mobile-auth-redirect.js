// Mobile auth redirect handler - CSP-compliant version with App Links support
(function() {
  console.log('=== MOBILE AUTH REDIRECT DEBUG ===');

  // Get the deep link and app link from the data attributes
  const deepLink = document.body.dataset.deepLink;
  const appLink = document.body.dataset.appLink;

  console.log('Deep link:', deepLink);
  console.log('App link:', appLink);
  console.log('User agent:', navigator.userAgent);
  console.log('Current URL:', window.location.href);

  if (deepLink) {
    // Update the manual link href (already set in template, but ensure it's correct)
    const manualLink = document.querySelector('.manual-link');
    if (manualLink && manualLink.href === '#') {
      manualLink.href = deepLink;
    }

    console.log('Manual link href:', manualLink ? manualLink.href : 'not found');

    // Try multiple redirect approaches for better compatibility
    console.log('Attempting automatic redirect...');

    // Method 1: Try window.location (works for custom schemes)
    try {
      console.log('Method 1: Setting window.location to:', deepLink);
      window.location.href = deepLink;
    } catch (error) {
      console.error('Method 1 failed:', error);
    }

    // Method 2: Create and click a hidden link (fallback)
    setTimeout(function() {
      try {
        console.log('Method 2: Creating hidden link');
        const hiddenLink = document.createElement('a');
        hiddenLink.href = deepLink;
        hiddenLink.style.display = 'none';
        document.body.appendChild(hiddenLink);
        hiddenLink.click();
        document.body.removeChild(hiddenLink);
        console.log('Method 2: Hidden link clicked');
      } catch (error) {
        console.error('Method 2 failed:', error);
      }
    }, 500);

    // Show manual link after delay if we're still here
    setTimeout(function() {
      console.log('Showing manual link after delay');
      if (manualLink) {
        manualLink.classList.add('visible');
        manualLink.style.display = 'block';
        manualLink.style.visibility = 'visible';
      }
    }, 2000);
  } else {
    console.error('No deep link found!');
  }

  console.log('===================================');
})();
