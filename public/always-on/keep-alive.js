/**
 * External Keep-Alive Script for Zenwa
 * Used by the public website to keep the application running 24/7
 * This script will ping the server periodically, even when the Replit window is closed
 */

// Configuration
const PING_INTERVAL = 10 * 60 * 1000; // 10 minutes in milliseconds
const PING_ENDPOINTS = [
  '/',              // Root endpoint
  '/health',        // Health check endpoint
  '/api/health',    // API health endpoint
  '/uptime'         // Uptime monitoring endpoint
];
let pingCounter = 0;
let pingIntervalId = null;
let statusElement = null;
let lastPingTime = null;
let lastPingStatus = null;

// Initialize the keep-alive system
function initKeepAlive() {
  console.log('Initializing external keep-alive system...');
  
  // Find status element if it exists
  statusElement = document.getElementById('keep-alive-status');
  
  // Start the ping process
  startPinging();
  
  // Automatically restart pinging if the browser tab becomes active again
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      restartPinging();
    }
  });
  
  // Send ping before the user closes the tab, if possible
  window.addEventListener('beforeunload', () => {
    sendPing();
  });
  
  // Successfully initialized
  updateStatus('initialized');
  console.log('External keep-alive system initialized successfully');
}

// Start the ping process
function startPinging() {
  if (pingIntervalId !== null) {
    clearInterval(pingIntervalId);
  }
  
  // First ping after 5 seconds
  setTimeout(() => sendPing(), 5000);
  
  // Schedule regular pings
  pingIntervalId = setInterval(() => sendPing(), PING_INTERVAL);
  console.log(`Ping scheduled every ${PING_INTERVAL / 60000} minutes`);
}

// Restart the ping process
function restartPinging() {
  console.log('Visibility changed to visible, checking ping status...');
  
  // Check if we need to restart pinging
  if (lastPingTime) {
    const timeSinceLastPing = Date.now() - lastPingTime;
    if (timeSinceLastPing > PING_INTERVAL) {
      console.log(`Last ping was ${Math.round(timeSinceLastPing / 60000)} minutes ago, restarting...`);
      startPinging();
    } else {
      console.log(`Last ping was ${Math.round(timeSinceLastPing / 1000)} seconds ago, continuing...`);
    }
  } else {
    console.log('No previous ping detected, starting ping process...');
    startPinging();
  }
}

// Send a ping to the server
async function sendPing() {
  pingCounter++;
  updateStatus('pinging');
  console.log(`Sending keep-alive ping to server...`);
  
  try {
    // Pick a random endpoint to avoid pattern detection
    const endpoint = PING_ENDPOINTS[Math.floor(Math.random() * PING_ENDPOINTS.length)];
    
    // Send the request
    const response = await fetch(endpoint, {
      method: 'GET',
      cache: 'no-store',
      headers: {
        'X-Keep-Alive': 'zenwa-external',
        'X-Ping-ID': `${pingCounter}`,
        'X-Ping-Time': new Date().toISOString()
      }
    });
    
    // Record ping time
    lastPingTime = Date.now();
    
    // Handle the response
    if (response.ok) {
      const data = await response.json();
      console.log(`Keep-alive ping successful:`, data);
      updateStatus('connected', data);
      lastPingStatus = 'success';
      return true;
    } else {
      console.error(`Keep-alive ping failed:`, response.status);
      updateStatus('error', {error: `HTTP ${response.status}`});
      lastPingStatus = 'error';
      return false;
    }
  } catch (error) {
    console.error(`Keep-alive ping failed:`, error);
    updateStatus('error', {error: error.message});
    lastPingStatus = 'error';
    return false;
  }
}

// Update the status element if it exists
function updateStatus(status, data) {
  if (!statusElement) return;
  
  // Update the status element
  statusElement.className = `keep-alive-status status-${status}`;
  
  let statusText = '';
  let statusTime = new Date().toLocaleTimeString();
  
  switch (status) {
    case 'initialized':
      statusText = 'System initialized';
      break;
    case 'pinging':
      statusText = 'Pinging server...';
      break;
    case 'connected':
      statusText = 'Connected';
      if (data && data.status) {
        statusText += ` (${data.status})`;
      }
      break;
    case 'error':
      statusText = 'Connection error';
      if (data && data.error) {
        statusText += `: ${data.error}`;
      }
      break;
    default:
      statusText = status;
  }
  
  statusElement.innerHTML = `<span class="status">${statusText}</span><span class="time">${statusTime}</span>`;
}

// Initialize when the page loads
window.addEventListener('load', initKeepAlive);
