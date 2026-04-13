/**
 * Sites Dashboard JavaScript
 * Handles site deletion and other dashboard interactions
 */

(function() {
  'use strict';

  // Delete site handler
  async function deleteSite(siteId, siteName) {
    if (!confirm('Are you sure you want to delete "' + siteName + '"? This action will also remove all associated resources (hosting, domain records, etc.) and cannot be undone.')) {
      return;
    }

    try {
      var response = await fetch('/api/sites/' + siteId, {
        method: 'DELETE',
        credentials: 'same-origin'
      });

      var data = await response.json();

      if (data.success) {
        location.reload();
      } else {
        alert('Error: ' + (data.error || 'Failed to delete site'));
      }
    } catch (error) {
      console.error('Delete error:', error);
      alert('Error: Failed to delete site. Please try again.');
    }
  }

  // Attach event listeners to delete buttons
  document.querySelectorAll('.delete-site-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var siteId = this.getAttribute('data-site-id');
      var siteName = this.getAttribute('data-site-name');
      deleteSite(siteId, siteName);
    });
  });
})();
