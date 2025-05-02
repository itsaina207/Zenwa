/**
 * Keep-Alive System for Zenwa
 * Provides functions to maintain 24/7 operation
 */

const os = require('os');
const http = require('http');
const https = require('https');
const { execSync } = require('child_process');

// Configuration
const PING_INTERVAL = 4 * 60 * 1000; // 4 minutes
const UPTIME_REPORT_INTERVAL = 6 * 60 * 60 * 1000; // 6 hours
const MAX_MEMORY_USAGE_MB = 500; // MB before triggering a potential restart
let pingCounter = 0;
let uptimeReportCounter = 0;

// Analyze system resources
function checkSystemResources() {
  try {
    const totalMemoryMB = Math.round(os.totalmem() / 1024 / 1024);
    const freeMemoryMB = Math.round(os.freemem() / 1024 / 1024);
    const usedMemoryMB = totalMemoryMB - freeMemoryMB;
    const memoryUsagePercent = Math.round((usedMemoryMB / totalMemoryMB) * 100);
    
    // Log system statistics
    console.log(`[SYSTEM] Memory Usage: ${usedMemoryMB}MB / ${totalMemoryMB}MB (${memoryUsagePercent}%)`);
    console.log(`[SYSTEM] CPU Load: ${os.loadavg()[0].toFixed(2)} (1m), ${os.loadavg()[1].toFixed(2)} (5m), ${os.loadavg()[2].toFixed(2)} (15m)`);
    console.log(`[SYSTEM] Uptime: ${Math.floor(os.uptime() / 3600)} hours, ${Math.floor((os.uptime() % 3600) / 60)} minutes`);
    
    // Check if memory usage is too high
    if (usedMemoryMB > MAX_MEMORY_USAGE_MB) {
      console.warn(`[WARNING] Memory usage (${usedMemoryMB}MB) is above threshold (${MAX_MEMORY_USAGE_MB}MB)`);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error(`[ERROR] Failed to check system resources: ${error.message}`);
    return true; // Assume system is fine when we can't check
  }
}

// Ping a URL
function pingUrl(url, isHttps = false) {
  return new Promise((resolve, reject) => {
    const client = isHttps ? https : http;
    
    const req = client.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve({ success: true, data, statusCode: res.statusCode });
        } else {
          resolve({ success: false, data, statusCode: res.statusCode });
        }
      });
    });
    
    req.on('error', (err) => {
      reject(err);
    });
    
    // Set a timeout of 10 seconds
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

// Check if application is running properly
async function healthCheck(port) {
  try {
    // Try local health endpoint first
    const localUrl = `http://localhost:${port}/health`;
    console.log(`[HEALTH] Checking local health at ${localUrl}`);
    
    try {
      const localResult = await pingUrl(localUrl, false);
      if (localResult.success) {
        console.log(`[HEALTH] Local health check successful: ${JSON.stringify(localResult.data)}`);
        return true;
      } else {
        console.warn(`[HEALTH] Local health check failed with status: ${localResult.statusCode}`);
        // If local check fails, try Replit URL if available
      }
    } catch (localError) {
      console.error(`[HEALTH] Local health check error: ${localError.message}`);
      // If local check errors, try Replit URL if available
    }
    
    // Try Replit URL as backup
    if (process.env.REPLIT_SLUG && process.env.REPLIT_OWNER) {
      const replitUrl = `https://${process.env.REPLIT_SLUG}.${process.env.REPLIT_OWNER}.repl.co/health`;
      console.log(`[HEALTH] Checking Replit health at ${replitUrl}`);
      
      try {
        const replitResult = await pingUrl(replitUrl, true);
        if (replitResult.success) {
          console.log(`[HEALTH] Replit health check successful: ${JSON.stringify(replitResult.data)}`);
          return true;
        } else {
          console.warn(`[HEALTH] Replit health check failed with status: ${replitResult.statusCode}`);
          return false;
        }
      } catch (replitError) {
        console.error(`[HEALTH] Replit health check error: ${replitError.message}`);
        return false;
      }
    }
    
    return false; // Both checks failed
  } catch (error) {
    console.error(`[HEALTH] Health check system error: ${error.message}`);
    return false;
  }
}

// Print uptime report
function reportUptime() {
  uptimeReportCounter++;
  const uptime = process.uptime();
  const days = Math.floor(uptime / 86400);
  const hours = Math.floor((uptime % 86400) / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);
  const seconds = Math.floor(uptime % 60);
  
  console.log('='.repeat(50));
  console.log(`[UPTIME] Report #${uptimeReportCounter}`);
  console.log(`[UPTIME] Server has been running for: ${days}d ${hours}h ${minutes}m ${seconds}s`);
  console.log(`[UPTIME] Ping counter: ${pingCounter} pings sent`); 
  console.log(`[UPTIME] Service status: ACTIVE`);
  console.log('='.repeat(50));
}

// Run keep-alive sequence
async function keepAlive(port) {
  pingCounter++;
  console.log(`[KEEP-ALIVE] Ping #${pingCounter} at ${new Date().toISOString()}`);
  
  // Check system resources
  const systemOk = checkSystemResources();
  if (!systemOk) {
    console.warn(`[KEEP-ALIVE] System resources may be running low`);
  }
  
  // Check application health
  try {
    const healthOk = await healthCheck(port);
    if (!healthOk) {
      console.warn(`[KEEP-ALIVE] Health check failed, but continuing operation`);
    }
  } catch (error) {
    console.error(`[KEEP-ALIVE] Error during health check: ${error.message}`);
  }
}

// Initialize the keep-alive system
function initKeepAliveSystem(port) {
  console.log(`[KEEP-ALIVE] Initializing keep-alive system with port ${port}`);
  
  // Initial ping after 10 seconds
  setTimeout(() => keepAlive(port), 10000);
  
  // Set up regular pinging
  setInterval(() => keepAlive(port), PING_INTERVAL);
  
  // Set up uptime reporting
  setInterval(reportUptime, UPTIME_REPORT_INTERVAL);
  
  // Initial uptime report
  setTimeout(reportUptime, 60000); // First report after 1 minute
  
  console.log(`[KEEP-ALIVE] System initialized successfully`);
  return true;
}

module.exports = {
  initKeepAliveSystem,
  keepAlive,
  healthCheck,
  reportUptime
};
