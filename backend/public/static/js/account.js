/**
 * Account Page JavaScript
 * Handles delete account modal and confirmation
 */

document.addEventListener('DOMContentLoaded', function() {
  const deleteBtn = document.getElementById('delete-account-btn');
  const modal = document.getElementById('delete-modal');
  const cancelBtn = document.getElementById('cancel-delete');
  const confirmInput = document.getElementById('confirm-delete');
  const confirmBtn = document.getElementById('confirm-delete-btn');
  const deleteForm = document.getElementById('delete-form');

  if (!deleteBtn || !modal) return;

  // Open modal
  deleteBtn.addEventListener('click', function() {
    modal.classList.add('show');
    confirmInput.value = '';
    confirmBtn.disabled = true;
    confirmInput.focus();
  });

  // Close modal
  function closeModal() {
    modal.classList.remove('show');
    confirmInput.value = '';
    confirmBtn.disabled = true;
  }

  cancelBtn.addEventListener('click', closeModal);

  // Close on backdrop click
  modal.addEventListener('click', function(e) {
    if (e.target === modal) {
      closeModal();
    }
  });

  // Close on Escape key
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && modal.classList.contains('show')) {
      closeModal();
    }
  });

  // Enable/disable confirm button based on input
  confirmInput.addEventListener('input', function() {
    const value = this.value.trim().toUpperCase();
    confirmBtn.disabled = value !== 'DELETE';
  });

  // Handle form submission
  deleteForm.addEventListener('submit', function(e) {
    const value = confirmInput.value.trim().toUpperCase();
    if (value !== 'DELETE') {
      e.preventDefault();
      return false;
    }

    // Disable button to prevent double submission
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Deleting...';
  });
});
