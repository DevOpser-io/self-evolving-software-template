/**
 * Time synchronization utility for TOTP verification
 * Follows the same approach as the DevOpser portal CICD project
 */

const Sntp = require('@hapi/sntp');

// State variables for time synchronization
let syncedTimeMs = null;
let ntpOffset = 0;
let synced = false;

/**
 * Synchronize with NTP server
 * @returns {Promise<Date>} Synchronized time as Date object
 */
async function syncClock() {
  try {
    // Query an NTP server with a short timeout
    const { t, now } = await Sntp.time({ 
      host: 'pool.ntp.org', 
      port: 123,
      timeout: 3000 // 3 second timeout
    });
    
    // Calculate offset between true time and local time
    ntpOffset = t - now;
    syncedTimeMs = t;
    synced = true;
    
    const syncedDate = new Date(t);
    console.log('NTP sync successful; offset =', ntpOffset, 'ms');
    console.log(`Synced time: ${syncedDate.toISOString()}`);
    console.log(`System time: ${new Date(now).toISOString()}`);
    
    return syncedDate;
  } catch (err) {
    console.error('NTP sync failed:', err.message);
    console.warn('Using system clock instead');
    synced = false;
    ntpOffset = 0;
    syncedTimeMs = Date.now();
    return new Date();
  }
}

/**
 * Get current synchronized time in seconds
 * @returns {number} Current time in seconds since epoch, adjusted by NTP offset
 */
function getSyncedTime() {
  // If we have a synchronized time, calculate the current time based on the offset
  const currentTimeMs = synced ? Date.now() + ntpOffset : Date.now();
  const seconds = Math.floor(currentTimeMs / 1000);
  
  if (synced) {
    console.log(`Using NTP-synced time: ${seconds}s (offset: ${ntpOffset}ms)`);
  } else {
    console.log(`Using system time: ${seconds}s (NTP sync failed)`);
  }
  
  return seconds;
}

// Immediately sync on startup
syncClock().catch(err => console.error('Initial time sync failed:', err.message));

// Re-sync every hour to prevent clock drift
setInterval(() => {
  syncClock().catch(err => console.error('Periodic time sync failed:', err.message));
}, 60 * 60 * 1000);

module.exports = {
  syncClock,
  getSyncedTime,
  isSynced: () => synced
};
