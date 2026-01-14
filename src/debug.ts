// Debug console functionality
// Unified logging to both browser console and in-app debug view

// Use existing debugLogs from HTML script, or create new one
export const debugLogs: string[] = window.debugLogs || [];
window.debugLogs = debugLogs;

// Unified debug logging - outputs to both console and debug view
export function dbg(msg: string, level: 'log' | 'warn' | 'error' = 'log'): void {
  const time = new Date().toLocaleTimeString();
  const entry = '[' + time + '] ' + msg;

  // Add to debug view
  debugLogs.push(entry);
  const el = document.getElementById('debugLog');
  if (el) el.textContent = debugLogs.join('\n');

  // Also output to browser console
  console[level]('[DBG]', msg);
}

// Ensure window.dbg is available
if (!window.dbg) {
  window.dbg = dbg;
}
