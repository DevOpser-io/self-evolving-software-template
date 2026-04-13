// OAuth redirect handler for mobile OAuth success page ONLY
(function() {
  // IMPORTANT: Only run this script on the mobile OAuth success page
  // This prevents interfering with normal web app authentication
  if (!window.location.pathname.includes('/auth/mobile/oauth-success')) {
    console.warn('OAuth redirect script should only run on /auth/mobile/oauth-success page, exiting');
    return;
  }

  // Use params passed from server or parse from URL as fallback
  const urlParams = window.oauthParams
    ? new URLSearchParams(window.oauthParams.queryString)
    : new URLSearchParams(window.location.search);

  // Determine the correct redirect base URL based on hostname
  const hostname = window.location.hostname;
  let redirectBase = window.location.origin; // Default to current origin

  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    // Local development
    redirectBase = `${window.location.protocol}//${window.location.host}`;
  }

  // Build redirect URLs
  const appLinkUrl = `${redirectBase}/mobile/auth?${urlParams.toString()}`;
  const deepLink = `com.bedrockexpress.app://oauth2redirect?${urlParams.toString()}`;

  // Update the manual link href
  const manualLink = document.getElementById('manual-redirect-link');
  if (manualLink) {
    manualLink.href = deepLink;
  }

  // Log for debugging
  console.log('OAuth redirect - App Link URL:', appLinkUrl);
  console.log('OAuth redirect - Deep Link:', deepLink);
  console.log('OAuth redirect - Params:', urlParams.toString());

  // Try HTTPS App Link immediately (preferred for Android with verified App Links)
  window.location.replace(appLinkUrl);

  // If we're still here after a short delay, try the deep link
  setTimeout(function() {
    console.log('Trying deep link fallback...');
    window.location.href = deepLink;
  }, 500);

  // Show fallback UI after a longer delay if still on page
  setTimeout(function() {
    // If we're still here after 2 seconds, show instructions
    const statusMsg = document.getElementById('status-message');
    if (statusMsg) statusMsg.textContent = 'Please tap the button below to return to the app';
    if (manualLink) {
      manualLink.style.display = 'block';
      manualLink.style.opacity = '1';
    }
  }, 2000);
})();
