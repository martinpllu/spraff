// ============ Unified Debug Logging ============

import type { DebugLevel, DebugLogEntry } from './types';

// Request tracking
let requestCounter = 0;

export function getNextRequestId(): number {
  return ++requestCounter;
}

export function dbg(msg: string, level: DebugLevel = 'log'): void {
  const entry: DebugLogEntry = {
    timestamp: Date.now(),
    level,
    message: msg,
  };

  // Add to global debug logs array
  window.debugLogs.push(entry);

  // Log to console
  const prefix = `[${new Date(entry.timestamp).toLocaleTimeString()}]`;
  switch (level) {
    case 'warn':
      console.warn(prefix, msg);
      break;
    case 'error':
      console.error(prefix, msg);
      break;
    default:
      console.log(prefix, msg);
  }

  // Update debug modal if visible
  updateDebugModal();
}

export function dbgRequest(id: number, description: string): void {
  dbg(`REQ #${id}: ${description}`);
}

export function dbgResponse(
  id: number,
  type: 'normal' | 'waiting' | 'tool_call' | 'aborted' | 'error',
  details?: string
): void {
  const msg = details ? `RES #${id} [${type}]: ${details}` : `RES #${id} [${type}]`;
  const level: DebugLevel = type === 'error' ? 'error' : 'log';
  dbg(msg, level);
}

function updateDebugModal(): void {
  const debugContent = document.getElementById('debugContent');
  if (!debugContent) return;

  const debugModal = document.getElementById('debugModal');
  if (debugModal?.classList.contains('hidden')) return;

  // Render logs
  debugContent.innerHTML = window.debugLogs
    .slice(-100) // Show last 100 entries
    .map((entry) => {
      const time = new Date(entry.timestamp).toLocaleTimeString();
      const levelClass = entry.level === 'error' ? 'debug-error' : entry.level === 'warn' ? 'debug-warn' : '';
      return `<div class="debug-line ${levelClass}"><span class="debug-time">${time}</span> ${escapeHtml(entry.message)}</div>`;
    })
    .join('');

  // Auto-scroll to bottom
  debugContent.scrollTop = debugContent.scrollHeight;
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function openDebugModal(): void {
  const modal = document.getElementById('debugModal');
  if (modal) {
    modal.classList.remove('hidden');
    updateDebugModal();
  }
}

export function closeDebugModal(): void {
  const modal = document.getElementById('debugModal');
  if (modal) {
    modal.classList.add('hidden');
  }
}

export function clearDebugLogs(): void {
  window.debugLogs = [];
  updateDebugModal();
}

// Initialize debug system
export function initDebug(): void {
  // Global error handler
  window.addEventListener('error', (event) => {
    dbg(`Uncaught error: ${event.message} at ${event.filename}:${event.lineno}`, 'error');
  });

  window.addEventListener('unhandledrejection', (event) => {
    dbg(`Unhandled promise rejection: ${event.reason}`, 'error');
  });

  dbg('Debug system initialized');
}
