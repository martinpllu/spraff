// Debug console functionality

// Use existing debugLogs from HTML script, or create new one
export const debugLogs: string[] = window.debugLogs || [];
window.debugLogs = debugLogs;

// Use existing dbg function or create it
export function dbg(msg: string): void {
  const time = new Date().toLocaleTimeString();
  const entry = '[' + time + '] ' + msg;
  debugLogs.push(entry);
  const el = document.getElementById('debugLog');
  if (el) el.textContent = debugLogs.join('\n');
}

// Ensure window.dbg is available
if (!window.dbg) {
  window.dbg = dbg;
}
