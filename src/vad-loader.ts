// VAD library lazy loader with caching
// Downloads ONNX runtime and VAD library on-demand when continuous mode is first enabled

import { dbg } from './debug';

const ONNX_VERSION = '1.14.0';
const VAD_VERSION = '0.0.19';

const ONNX_CDN_BASE = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ONNX_VERSION}/dist`;
const VAD_CDN_BASE = `https://cdn.jsdelivr.net/npm/@ricky0123/vad-web@${VAD_VERSION}/dist`;

// Approximate sizes for user information (uncompressed)
export const VAD_DOWNLOAD_SIZE_MB = 14; // ~3.8MB ort.js + ~8.8MB WASM + ~1.7MB model

const VAD_DOWNLOADED_KEY = 'vad-downloaded';

let vadLoaded = false;
let loadPromise: Promise<void> | null = null;

// Check if VAD is already available (loaded in a previous session or from cache)
export function isVADAvailable(): boolean {
  return typeof vad !== 'undefined' && typeof ort !== 'undefined';
}

// Check if VAD has been downloaded before (stored in localStorage)
export function hasVADBeenDownloaded(): boolean {
  return localStorage.getItem(VAD_DOWNLOADED_KEY) === 'true';
}

// Mark VAD as downloaded
function markVADDownloaded(): void {
  localStorage.setItem(VAD_DOWNLOADED_KEY, 'true');
}

// Check if VAD has been loaded in this session or was previously downloaded
export function isVADLoaded(): boolean {
  return vadLoaded || isVADAvailable() || hasVADBeenDownloaded();
}

// Load a script dynamically
function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // Check if already loaded
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
    document.head.appendChild(script);
  });
}

// Configure ONNX runtime after it's loaded
function configureONNX(): void {
  if (typeof ort !== 'undefined') {
    ort.env.wasm.wasmPaths = `${ONNX_CDN_BASE}/`;
    dbg('ONNX runtime configured');
  }
}

// Load VAD library and dependencies
export async function loadVADLibrary(
  onProgress?: (stage: string) => void
): Promise<void> {
  // Already loaded
  if (isVADAvailable()) {
    vadLoaded = true;
    return;
  }

  // Loading in progress
  if (loadPromise) {
    return loadPromise;
  }

  loadPromise = (async () => {
    try {
      // Load ONNX runtime first
      onProgress?.('Loading ONNX runtime...');
      dbg('Loading ONNX runtime from CDN');
      await loadScript(`${ONNX_CDN_BASE}/ort.js`);

      // Configure WASM paths before VAD loads
      configureONNX();

      // Load VAD library
      onProgress?.('Loading voice detection...');
      dbg('Loading VAD library from CDN');
      await loadScript(`${VAD_CDN_BASE}/bundle.min.js`);

      // The model will be loaded when MicVAD.new() is called
      onProgress?.('Ready');
      dbg('VAD library loaded successfully');
      vadLoaded = true;
      markVADDownloaded();
    } catch (error) {
      loadPromise = null;
      throw error;
    }
  })();

  return loadPromise;
}
