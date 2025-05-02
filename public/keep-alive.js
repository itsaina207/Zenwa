/**
 * Keep Alive Script
 * This script is loaded in the frontend to help keep the Replit app running 24/7
 */

// Send periodic pings to the server
const PING_INTERVAL = 4 * 60 * 1000; // 4 minutes (staggered from server's own 5-minute ping)

function pingServer() {
  console.log('Sending keep-alive ping to server...');
  
  fetch('/health')
    .then(response => response.json())
    .then(data => {
      console.log('Keep-alive ping successful:', data);
      // Update ping status indicator if it exists
      const statusElement = document.getElementById('ping-status');
      if (statusElement) {
        statusElement.textContent = `Last ping: ${new Date().toLocaleTimeString()}`;
        statusElement.style.color = 'green';
        
        // Reset color after 5 seconds
        setTimeout(() => {
          statusElement.style.color = 'inherit';
        }, 5000);
      }
    })
    .catch(error => {
      console.error('Keep-alive ping failed:', error);
      // Update ping status indicator if it exists
      const statusElement = document.getElementById('ping-status');
      if (statusElement) {
        statusElement.textContent = `Ping failed: ${error.message}`;
        statusElement.style.color = 'red';
      }
    });
}

// Start pinging when the script loads
pingServer();

// Set up periodic pinging
setInterval(pingServer, PING_INTERVAL);

// Also ping on window focus to quickly restore connection after computer sleep
window.addEventListener('focus', pingServer);
