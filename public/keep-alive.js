/**
 * Keep-Alive System for Zenwa
 * Provides functions to maintain 24/7 operation
 */

// Configuration
const KEEP_ALIVE_PING_INTERVAL = 5 * 60 * 1000; // 5 minutes
let pingCounter = 0;

// Function to ping the server
async function pingServer() {
    pingCounter++;
    console.log("Sending keep-alive ping to server...");
    
    try {
        const response = await fetch('/health');
        if (response.ok) {
            const data = await response.json();
            console.log("Keep-alive ping successful:", data);
            updatePingStatus(true);
            return data;
        } else {
            console.error("Keep-alive ping failed:", response.status);
            updatePingStatus(false);
        }
    } catch (error) {
        console.error("Keep-alive ping error:", error);
        updatePingStatus(false);
    }
}

// Update the ping status indicator
function updatePingStatus(isOnline) {
    const statusElement = document.getElementById('ping-status');
    if (statusElement) {
        statusElement.textContent = isOnline ? 
            "Server monitoring active" : 
            "Server connection issue detected";
        statusElement.style.color = isOnline ? "#4caf50" : "#f44336";
    }
}

// Initial ping after page load
window.addEventListener('load', () => {
    // First ping after 5 seconds
    setTimeout(pingServer, 5000);
    
    // Set up regular pinging
    setInterval(pingServer, KEEP_ALIVE_PING_INTERVAL);
});
