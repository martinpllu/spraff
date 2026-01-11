    // Temporarily disable service worker for debugging
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(registrations => {
        registrations.forEach(reg => reg.unregister());
      });
    }

    // ============ Debug Console ============
    // Use existing debugLogs from HTML script, or create new one
    const debugLogs = window.debugLogs || [];
    window.debugLogs = debugLogs;

    // Use existing dbg function or enhance it
    if (!window.dbg) {
      window.dbg = function(msg) {
        const time = new Date().toLocaleTimeString();
        const entry = '[' + time + '] ' + msg;
        debugLogs.push(entry);
        const el = document.getElementById('debugLog');
        if (el) el.textContent = debugLogs.join('\n');
      };
    }

    const APP_VERSION = '94bb79';
    console.log('Spraff version:', APP_VERSION);
    window.dbg('app.js loaded, version: ' + APP_VERSION);

    // ============ Configuration ============
    const OPENROUTER_AUTH_URL = 'https://openrouter.ai/auth';
    const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1';
    const MODEL = 'google/gemini-3-flash-preview';
    const MODEL_ONLINE = 'google/gemini-3-flash-preview:online';
    const CALLBACK_URL = window.location.origin + window.location.pathname;

    // ============ Conversation Persistence ============
    function loadConversationHistory() {
      try {
        const saved = localStorage.getItem('conversationHistory');
        return saved ? JSON.parse(saved) : [];
      } catch (e) {
        console.warn('Failed to load conversation history:', e);
        return [];
      }
    }

    function saveConversationHistory() {
      try {
        localStorage.setItem('conversationHistory', JSON.stringify(conversationHistory));
      } catch (e) {
        console.warn('Failed to save conversation history:', e);
      }
      updateVoiceSummary();
    }

    function clearConversationHistory() {
      conversationHistory = [];
      try {
        localStorage.removeItem('conversationHistory');
      } catch (e) {
        console.warn('Failed to clear conversation history:', e);
      }
    }

    // ============ Pending Voice Message Persistence ============
    function savePendingVoiceMessage(base64Audio) {
      try {
        localStorage.setItem('pendingVoiceMessage', base64Audio);
        localStorage.setItem('pendingVoiceTimestamp', Date.now().toString());
      } catch (e) {
        console.warn('Failed to save pending voice message:', e);
      }
    }

    function clearPendingVoiceMessage() {
      try {
        localStorage.removeItem('pendingVoiceMessage');
        localStorage.removeItem('pendingVoiceTimestamp');
      } catch (e) {
        console.warn('Failed to clear pending voice message:', e);
      }
    }

    function getPendingVoiceMessage() {
      try {
        const audio = localStorage.getItem('pendingVoiceMessage');
        const timestamp = localStorage.getItem('pendingVoiceTimestamp');
        if (audio && timestamp) {
          // Only return if less than 1 hour old
          const age = Date.now() - parseInt(timestamp, 10);
          if (age < 60 * 60 * 1000) {
            return audio;
          } else {
            clearPendingVoiceMessage();
          }
        }
        return null;
      } catch (e) {
        console.warn('Failed to get pending voice message:', e);
        return null;
      }
    }

    // ============ State ============
    let apiKey = localStorage.getItem('openrouter_api_key');
    let isListening = false;
    let conversationHistory = loadConversationHistory();
    let mediaRecorder = null;
    let audioChunks = [];
    let audioStream = null;
    let recordingCancelled = false;
    let selectedVoiceName = localStorage.getItem('selectedVoice') || null;
    let cloudVoicesEnabled = localStorage.getItem('cloudVoicesEnabled') === 'true';
    let speechQueue = [];
    let isSpeaking = false;
    let shouldStopSpeaking = false;
    let speechTotalChars = 0;
    let speechSpokenChars = 0;
    let textMode = localStorage.getItem('textMode') === 'true';
    let isProcessingText = false;
    const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    let currentStreamingElement = null;

    // Continuous mode state
    let continuousModeActive = false;
    let vadInstance = null;
    let vadSuppressed = false;
    const SPEECH_END_BUFFER_MS = 600;

    // Mic bleed detection and interruption
    let micBleedDetected = null; // null = not yet tested, true = bleed, false = no bleed
    let isDetectingBleed = false;
    let interruptionEnabled = false;
    let micPermissionGranted = false; // Track if mic permission has been granted
    const BLEED_DETECTION_WINDOW_MS = 1500; // Listen for bleed during first 1.5s of first response

    // Stats
    const stats = {
      sessionCost: 0,
      lastCost: 0,
      lastVoiceSize: 0
    };

    // ============ DOM Elements ============
    const loginScreen = document.getElementById('loginScreen');
    const voiceScreen = document.getElementById('voiceScreen');
    const loginBtn = document.getElementById('loginBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const mainButton = document.getElementById('mainButton');
    const statusText = document.getElementById('statusText');
    const hintText = document.getElementById('hintText');
    const settingsMenu = document.getElementById('settingsMenu');
    const settingsMenuBtn = document.getElementById('settingsMenuBtn');
    const settingsDropdown = document.getElementById('settingsDropdown');
    const voiceSettingsBtn = document.getElementById('voiceSettingsBtn');
    const stopBtn = document.getElementById('stopBtn');
    const cancelBtn = document.getElementById('cancelBtn');
    const voiceModal = document.getElementById('voiceModal');
    const modalClose = document.getElementById('modalClose');
    const voiceList = document.getElementById('voiceList');
    const costModal = document.getElementById('costModal');
    const costModalClose = document.getElementById('costModalClose');
    const costSettingsBtn = document.getElementById('costSettingsBtn');
    const copyChatBtn = document.getElementById('copyChatBtn');
    const costBalance = document.getElementById('costBalance');
    const costLast = document.getElementById('costLast');
    const costSession = document.getElementById('costSession');
    const costVoiceSize = document.getElementById('costVoiceSize');
    const voiceSizeStat = document.getElementById('voiceSizeStat');
    const aboutModal = document.getElementById('aboutModal');
    const aboutModalClose = document.getElementById('aboutModalClose');
    const aboutBtn = document.getElementById('aboutBtn');
    const privacyModal = document.getElementById('privacyModal');
    const privacyModalClose = document.getElementById('privacyModalClose');
    const privacyBtn = document.getElementById('privacyBtn');
    const debugModal = document.getElementById('debugModal');
    const debugModalClose = document.getElementById('debugModalClose');
    const debugBtn = document.getElementById('debugBtn');
    const debugClearBtn = document.getElementById('debugClearBtn');
    const errorToast = document.getElementById('errorToast');
    const installBtn = document.getElementById('installBtn');
    const installModal = document.getElementById('installModal');
    const installModalClose = document.getElementById('installModalClose');
    const textInputContainer = document.getElementById('textInputContainer');
    const textInput = document.getElementById('textInput');
    const textSendBtn = document.getElementById('textSendBtn');
    const modeToggle = document.getElementById('modeToggle');
    const voiceModeBtn = document.getElementById('voiceModeBtn');
    const textModeBtn = document.getElementById('textModeBtn');
    const conversationHistoryEl = document.getElementById('conversationHistory');
    const clearChatBtn = document.getElementById('clearChatBtn');
    const clearChatBadge = document.getElementById('clearChatBadge');
    const exitContinuousBtn = document.getElementById('exitContinuousBtn');

    // ============ Initialization ============
    function init() {
      if (window.dbg) window.dbg('init() called');
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');

      if (code) {
        handleOAuthCallback(code);
        return;
      }

      if (apiKey) {
        showVoiceScreen();
      } else {
        showLoginScreen();
      }

      updateModeUI();
      setupEventListeners();
      lockOrientation();
      checkPendingVoiceMessage();
      updateVoiceSummary();
    }

    // ============ Pending Voice Message Recovery ============
    async function checkPendingVoiceMessage() {
      if (!apiKey) return;
      // Don't retry if we're already doing something
      if (isListening || isSpeaking || isProcessingText) return;

      const pendingAudio = getPendingVoiceMessage();
      if (pendingAudio) {
        const sizeKB = Math.round(pendingAudio.length * 0.75 / 1024);
        // Auto-retry the upload
        setButtonState('processing');
        statusText.textContent = `Retrying ${sizeKB} KB`;

        try {
          await sendAudioToAPI(pendingAudio);
          clearPendingVoiceMessage();
        } catch (e) {
          console.error('Failed to retry pending voice message:', e);
          showError('Failed to send saved voice message');
          setButtonState('ready');
        }
      }
    }

    // Retry pending audio when app returns to foreground (PWA support)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        checkPendingVoiceMessage();
      }
    });

    // ============ PWA Install Prompt ============
    let deferredInstallPrompt = null;
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

    if (!isStandalone) {
      // Capture the install prompt (Chrome/Brave/Edge on desktop and Android)
      window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredInstallPrompt = e;
        installBtn.classList.remove('hidden');
      });

      // Show install button on iOS Safari (no beforeinstallprompt event)
      if (isMobile && isIOS) {
        installBtn.classList.remove('hidden');
      }

      // Hide install button if app gets installed
      window.addEventListener('appinstalled', () => {
        installBtn.classList.add('hidden');
        deferredInstallPrompt = null;
      });
    }

    function handleInstallClick() {
      settingsDropdown.classList.remove('open');

      if (deferredInstallPrompt) {
        // Trigger native install prompt
        deferredInstallPrompt.prompt();
        deferredInstallPrompt.userChoice.then((result) => {
          if (result.outcome === 'accepted') {
            installBtn.classList.add('hidden');
          }
          deferredInstallPrompt = null;
        });
      } else if (isMobile && isIOS) {
        // iOS Safari - show instructions modal
        installModal.classList.remove('hidden');
      }
    }

    // ============ Orientation Lock ============
    function lockOrientation() {
      // Only attempt on mobile devices
      if (!isMobile) return;

      // Try Screen Orientation API (works in some PWA contexts)
      if (screen.orientation && screen.orientation.lock) {
        screen.orientation.lock('portrait').catch(() => {
          // Silently fail - CSS fallback will handle it
        });
      }
    }

    // ============ OAuth Flow ============
    function generateCodeVerifier() {
      const array = new Uint8Array(32);
      crypto.getRandomValues(array);
      return btoa(String.fromCharCode(...array))
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    }

    async function generateCodeChallenge(verifier) {
      const encoder = new TextEncoder();
      const data = encoder.encode(verifier);
      const hash = await crypto.subtle.digest('SHA-256', data);
      return btoa(String.fromCharCode(...new Uint8Array(hash)))
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    }

    async function startOAuthFlow() {
      const codeVerifier = generateCodeVerifier();
      const codeChallenge = await generateCodeChallenge(codeVerifier);
      sessionStorage.setItem('code_verifier', codeVerifier);
      const authUrl = `${OPENROUTER_AUTH_URL}?callback_url=${encodeURIComponent(CALLBACK_URL)}&code_challenge=${codeChallenge}&code_challenge_method=S256`;
      window.location.href = authUrl;
    }

    async function handleOAuthCallback(code) {
      const codeVerifier = sessionStorage.getItem('code_verifier');
      if (!codeVerifier) {
        // Clear any stale credentials on auth failure
        clearCredentials();
        showError('Authentication failed');
        showLoginScreen();
        return;
      }

      try {
        const response = await fetch(`${OPENROUTER_API_URL}/auth/keys`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code,
            code_verifier: codeVerifier,
            code_challenge_method: 'S256'
          })
        });

        if (!response.ok) throw new Error('Failed to authenticate');

        const data = await response.json();
        apiKey = data.key;
        localStorage.setItem('openrouter_api_key', apiKey);
        sessionStorage.removeItem('code_verifier');
        window.history.replaceState({}, document.title, window.location.pathname);
        showVoiceScreen();
        updateModeUI();
        setupEventListeners();
      } catch (error) {
        console.error('OAuth error:', error);
        // Clear any stale credentials on auth failure
        clearCredentials();
        showError('Authentication failed');
        showLoginScreen();
      }
    }

    function clearCredentials() {
      apiKey = null;
      localStorage.removeItem('openrouter_api_key');
      sessionStorage.removeItem('code_verifier');
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    function logout() {
      clearCredentials();
      clearConversationHistory();
      showLoginScreen();
    }

    // ============ UI State ============
    function showLoginScreen() {
      // Remove the style tag injected during OAuth callback (if present)
      document.getElementById('oauth-hide-login')?.remove();
      loginScreen.classList.remove('hidden');
      voiceScreen.classList.add('hidden');
    }

    function showVoiceScreen() {
      loginScreen.classList.add('hidden');
      voiceScreen.classList.remove('hidden');
    }

    function setButtonState(state) {
      mainButton.classList.remove('listening', 'processing', 'speaking', 'continuous-listening');
      statusText.classList.remove('listening', 'speaking', 'continuous');

      switch (state) {
        case 'listening':
          mainButton.classList.add('listening');
          statusText.classList.add('listening');
          statusText.textContent = 'Listening';
          hintText.textContent = 'Push button or Space to send';
          hintText.classList.remove('hidden');
          cancelBtn.classList.remove('hidden');
          break;
        case 'processing':
          mainButton.classList.add('processing');
          statusText.textContent = 'Thinking';
          hintText.classList.add('hidden');
          cancelBtn.classList.add('hidden');
          break;
        case 'speaking':
          mainButton.classList.add('speaking');
          statusText.classList.add('speaking');
          statusText.textContent = 'Speaking';
          hintText.classList.add('hidden');
          cancelBtn.classList.add('hidden');
          break;
        case 'continuous-ready':
          statusText.classList.add('continuous');
          statusText.textContent = 'Continuous Mode';
          hintText.textContent = 'Speak anytime. Double-click to exit';
          hintText.classList.remove('hidden');
          cancelBtn.classList.add('hidden');
          break;
        case 'continuous-listening':
          mainButton.classList.add('continuous-listening');
          statusText.classList.add('continuous', 'listening');
          statusText.textContent = 'Listening...';
          hintText.classList.add('hidden');
          cancelBtn.classList.add('hidden');
          break;
        default:
          statusText.textContent = 'Ready';
          hintText.textContent = 'Push button or Space to speak';
          hintText.classList.remove('hidden');
          cancelBtn.classList.add('hidden');
      }
    }

    function showError(message) {
      errorToast.textContent = message;
      errorToast.classList.add('visible');
      setTimeout(() => errorToast.classList.remove('visible'), 4000);
    }

    function updateSessionCost(cost) {
      stats.lastCost = cost;
      stats.sessionCost += cost;
    }

    function formatFileSize(bytes) {
      if (bytes < 1024) return bytes + ' B';
      if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
      return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    }

    async function openCostModal() {
      settingsDropdown.classList.remove('open');
      costModal.classList.remove('hidden');

      // Update session stats
      costLast.textContent = stats.lastCost > 0 ? `$${stats.lastCost.toFixed(5)}` : '—';
      costSession.textContent = `$${stats.sessionCost.toFixed(5)}`;

      // Show voice size if we have one
      if (stats.lastVoiceSize > 0) {
        voiceSizeStat.style.display = '';
        costVoiceSize.textContent = formatFileSize(stats.lastVoiceSize);
      } else {
        voiceSizeStat.style.display = 'none';
      }

      // Fetch balance
      costBalance.textContent = '...';
      try {
        const response = await fetch(`${OPENROUTER_API_URL}/credits`, {
          headers: { 'Authorization': `Bearer ${apiKey}` }
        });
        if (response.ok) {
          const data = await response.json();
          const totalCredits = data.data?.total_credits ?? 0;
          const totalUsage = data.data?.total_usage ?? 0;
          const balance = totalCredits - totalUsage;
          costBalance.textContent = `$${balance.toFixed(2)}`;
        } else {
          costBalance.textContent = '—';
        }
      } catch (e) {
        console.warn('Failed to fetch balance:', e);
        costBalance.textContent = '—';
      }
    }

    function closeCostModal() {
      costModal.classList.add('hidden');
    }

    async function copyChat() {
      settingsDropdown.classList.remove('open');

      if (conversationHistory.length === 0) {
        showError('No conversation to copy');
        return;
      }

      let markdown = '';
      for (const msg of conversationHistory) {
        if (msg.role === 'user') {
          markdown += `**You:** ${msg.content}\n\n`;
        } else {
          markdown += `**Assistant:** ${msg.content}\n\n`;
        }
      }

      try {
        await navigator.clipboard.writeText(markdown.trim());
        // Show brief success feedback
        const originalText = copyChatBtn.textContent;
        copyChatBtn.innerHTML = `<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg> Copied!`;
        setTimeout(() => {
          copyChatBtn.innerHTML = `<svg viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy chat`;
        }, 1500);
      } catch (e) {
        showError('Failed to copy to clipboard');
      }
    }

    // ============ Markdown Parsing ============
    function parseMarkdown(text) {
      if (!text) return '';

      let html = text;

      // Helper to escape HTML
      const escapeHtml = (str) => str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

      // Code blocks - extract first and replace with placeholders
      const codeBlocks = [];
      html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
        const trimmed = code.replace(/^\n+|\n+$/g, '');
        const placeholder = `\x00CODEBLOCK${codeBlocks.length}\x00`;
        codeBlocks.push(`<pre><code>${escapeHtml(trimmed)}</code></pre>`);
        return placeholder;
      });

      // Tables (before HTML escaping, so we can detect pipe characters)
      // Process line by line to find table blocks
      const tableInputLines = html.split('\n');
      const processedLines = [];
      let tableLines = [];

      for (let i = 0; i < tableInputLines.length; i++) {
        const line = tableInputLines[i].trim();
        const isTableRow = line.startsWith('|') && line.endsWith('|');

        if (isTableRow) {
          tableLines.push(line);
        } else {
          // Process accumulated table lines if any
          if (tableLines.length >= 2) {
            const table = parseTable(tableLines, escapeHtml);
            if (table) {
              processedLines.push(table);
            } else {
              processedLines.push(...tableLines);
            }
          } else if (tableLines.length > 0) {
            processedLines.push(...tableLines);
          }
          tableLines = [];
          processedLines.push(tableInputLines[i]);
        }
      }

      // Handle table at end of content
      if (tableLines.length >= 2) {
        const table = parseTable(tableLines, escapeHtml);
        if (table) {
          processedLines.push(table);
        } else {
          processedLines.push(...tableLines);
        }
      } else if (tableLines.length > 0) {
        processedLines.push(...tableLines);
      }

      html = processedLines.join('\n');

      function parseTable(rows, escape) {
        if (rows.length < 2) return null;

        // Check if second row is separator (|---|---|)
        const separatorRow = rows[1];
        if (!/^\|[\s\-:]+(\|[\s\-:]+)+\|$/.test(separatorRow)) return null;

        let tableHtml = '<div class="table-wrapper"><table>';

        // Header row
        const headerCells = rows[0].split('|').slice(1, -1);
        tableHtml += '<thead><tr>';
        headerCells.forEach(cell => {
          tableHtml += '<th>' + escape(cell.trim()) + '</th>';
        });
        tableHtml += '</tr></thead>';

        // Body rows (skip header and separator)
        if (rows.length > 2) {
          tableHtml += '<tbody>';
          for (let i = 2; i < rows.length; i++) {
            const cells = rows[i].split('|').slice(1, -1);
            tableHtml += '<tr>';
            cells.forEach(cell => {
              tableHtml += '<td>' + escape(cell.trim()) + '</td>';
            });
            tableHtml += '</tr>';
          }
          tableHtml += '</tbody>';
        }

        tableHtml += '</table></div>';
        return tableHtml;
      }

      // Escape HTML for remaining content (but not the table HTML we just created)
      html = html.replace(/^(?!<div|<\/div|<table|<\/table|<thead|<\/thead|<tbody|<\/tbody|<tr|<\/tr|<th|<\/th|<td|<\/td)(.*)$/gm, (match) => {
        if (match.startsWith('<div') || match.startsWith('</div') ||
            match.startsWith('<table') || match.startsWith('</table') ||
            match.startsWith('<thead') || match.startsWith('</thead') ||
            match.startsWith('<tbody') || match.startsWith('</tbody') ||
            match.startsWith('<tr') || match.startsWith('</tr') ||
            match.startsWith('<th') || match.startsWith('</th') ||
            match.startsWith('<td') || match.startsWith('</td')) {
          return match;
        }
        return match
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
      });

      // Inline code (must be before other inline processing)
      html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

      // Headers
      html = html.replace(/^#### (.+)$/gm, '<h4>$1</h4>');
      html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
      html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
      html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

      // Bold and italic (order matters)
      html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
      html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
      html = html.replace(/___(.+?)___/g, '<strong><em>$1</em></strong>');
      html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');
      html = html.replace(/_(.+?)_/g, '<em>$1</em>');

      // Links
      html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

      // Blockquotes
      html = html.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');

      // Horizontal rules
      html = html.replace(/^---$/gm, '<hr>');
      html = html.replace(/^\*\*\*$/gm, '<hr>');

      // Unordered lists
      html = html.replace(/^[\-\*] (.+)$/gm, '<li>$1</li>');
      html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');

      // Ordered lists
      html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');
      // Only wrap consecutive <li> that aren't already in <ul>
      html = html.replace(/(<li>.*<\/li>\n?)(?!<\/ul>)/g, (match, p1, offset) => {
        const before = html.substring(0, offset);
        if (before.endsWith('<ul>') || before.match(/<li>.*<\/li>\n?$/)) {
          return match;
        }
        return match;
      });

      // Paragraphs - wrap lines that aren't already wrapped
      const lines = html.split('\n');
      const processed = [];
      let inList = false;

      for (let line of lines) {
        const trimmed = line.trim();
        if (!trimmed) {
          processed.push('');
          continue;
        }

        // Check if line is already an HTML element
        if (trimmed.match(/^<(h[1-4]|ul|ol|li|pre|blockquote|hr|p|table|thead|tbody|tr|th|td)/)) {
          processed.push(line);
          continue;
        }

        // Track list state
        if (trimmed.startsWith('<ul>') || trimmed.startsWith('<ol>')) {
          inList = true;
        }
        if (trimmed.endsWith('</ul>') || trimmed.endsWith('</ol>')) {
          inList = false;
        }

        if (inList || trimmed.startsWith('<li>')) {
          processed.push(line);
        } else {
          processed.push(`<p>${trimmed}</p>`);
        }
      }

      html = processed.join('\n');

      // Clean up empty paragraphs and normalize
      html = html.replace(/<p><\/p>/g, '');
      html = html.replace(/\n+/g, '\n');

      // Restore code blocks from placeholders
      codeBlocks.forEach((block, i) => {
        html = html.replace(`\x00CODEBLOCK${i}\x00`, block);
        html = html.replace(`<p>\x00CODEBLOCK${i}\x00</p>`, block);
      });

      return html;
    }

    // ============ New Chat ============
    function startNewChat() {
      clearConversationHistory();
      clearPendingVoiceMessage();
      conversationHistoryEl.innerHTML = '';
      stats.sessionCost = 0;
      stats.lastCost = 0;
      stats.lastVoiceSize = 0;
    }


    // ============ Mode Switching ============
    function updateModeUI() {
      if (textMode) {
        voiceScreen.classList.add('text-mode');
        textInputContainer.classList.add('visible');
        conversationHistoryEl.classList.add('visible');
        voiceModeBtn.classList.remove('active');
        textModeBtn.classList.add('active');
        renderConversationHistory();
        // Only auto-focus on desktop to avoid keyboard popping up on mobile
        if (!isMobile) {
          textInput.focus();
        }
      } else {
        voiceScreen.classList.remove('text-mode');
        textInputContainer.classList.remove('visible');
        conversationHistoryEl.classList.remove('visible');
        voiceModeBtn.classList.add('active');
        textModeBtn.classList.remove('active');
      }
    }

    function setTextMode(enabled) {
      textMode = enabled;
      localStorage.setItem('textMode', enabled);
      updateModeUI();
    }

    // ============ Voice Mode Summary ============
    function updateVoiceSummary() {
      if (conversationHistory.length === 0) {
        clearChatBtn.classList.add('hidden');
        return;
      }

      // Count user messages only
      const messageCount = conversationHistory.filter(m => m.role === 'user').length;
      if (messageCount === 0) {
        clearChatBtn.classList.add('hidden');
        return;
      }

      clearChatBadge.textContent = messageCount;
      clearChatBtn.classList.remove('hidden');
    }

    function renderConversationHistory() {
      conversationHistoryEl.innerHTML = '';

      for (let i = 0; i < conversationHistory.length; i += 2) {
        const userMsg = conversationHistory[i];
        const assistantMsg = conversationHistory[i + 1];

        if (userMsg) {
          const group = document.createElement('div');
          group.className = 'message-group';

          const userEl = document.createElement('div');
          userEl.className = 'message user';
          userEl.textContent = userMsg.content;
          group.appendChild(userEl);

          if (assistantMsg) {
            const assistantEl = document.createElement('div');
            assistantEl.className = 'message assistant';
            assistantEl.innerHTML = parseMarkdown(assistantMsg.content);
            group.appendChild(assistantEl);
          }

          conversationHistoryEl.appendChild(group);
        }
      }

      scrollToBottom();
    }

    function scrollToBottom() {
      conversationHistoryEl.scrollTop = conversationHistoryEl.scrollHeight;
    }

    function addMessageToHistory(role, content, streaming = false) {
      // Find the last message group (skip spacer if present)
      let group = conversationHistoryEl.lastElementChild;
      if (group && group.classList.contains('scroll-spacer')) {
        group = group.previousElementSibling;
      }

      if (role === 'user') {
        // Ensure spacer exists at the end
        let spacer = conversationHistoryEl.querySelector('.scroll-spacer');
        if (!spacer) {
          spacer = document.createElement('div');
          spacer.className = 'scroll-spacer';
          conversationHistoryEl.appendChild(spacer);
        }
        // Spacer height = viewport height so we can scroll the last item to top
        spacer.style.height = conversationHistoryEl.clientHeight + 'px';

        // Create new group for user message, insert before spacer
        group = document.createElement('div');
        group.className = 'message-group';
        conversationHistoryEl.insertBefore(group, spacer);

        const userEl = document.createElement('div');
        userEl.className = 'message user';
        userEl.textContent = content;
        group.appendChild(userEl);

        // Scroll so user message appears at top of visible area
        requestAnimationFrame(() => {
          // Calculate how far the group is from the top of the scrollable content
          // by measuring its position relative to the container and adding current scroll
          const containerTop = conversationHistoryEl.getBoundingClientRect().top;
          const groupTop = group.getBoundingClientRect().top;
          const relativePosition = groupTop - containerTop;
          const scrollTarget = conversationHistoryEl.scrollTop + relativePosition - 72; // 72px = ~4.5rem padding
          conversationHistoryEl.scrollTo({
            top: Math.max(0, scrollTarget),
            behavior: 'smooth'
          });
        });
        return;
      } else {
        // Assistant message goes in the last group
        if (!group) {
          group = document.createElement('div');
          group.className = 'message-group';
          conversationHistoryEl.appendChild(group);
        }

        let assistantEl = group.querySelector('.message.assistant');
        if (!assistantEl) {
          assistantEl = document.createElement('div');
          assistantEl.className = 'message assistant';
          group.appendChild(assistantEl);
        }

        assistantEl.textContent = content;
        if (streaming) {
          assistantEl.classList.add('streaming');
          currentStreamingElement = assistantEl;
        } else {
          assistantEl.classList.remove('streaming');
          currentStreamingElement = null;
        }
      }
    }

    function updateStreamingMessage(content) {
      if (currentStreamingElement) {
        currentStreamingElement.innerHTML = parseMarkdown(content);
      }
    }

    function finishStreamingMessage() {
      if (currentStreamingElement) {
        currentStreamingElement.classList.remove('streaming');
        currentStreamingElement = null;
      }
    }

    // ============ Audio Recording ============
    async function startRecording() {
      if (window.dbg) window.dbg('startRecording CALLED');
      try {
        audioChunks = [];

        // Check if mediaDevices API is available
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          console.error('mediaDevices API not available');
          showError('Browser does not support audio recording');
          return;
        }

        // Enumerate devices first to check what's available
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const audioInputs = devices.filter(d => d.kind === 'audioinput');
          console.log('Available audio inputs:', audioInputs);

          if (audioInputs.length === 0) {
            showError('No microphone found. Check browser permissions.');
            setButtonState('ready');
            return;
          }
        } catch (enumError) {
          console.warn('Could not enumerate devices:', enumError);
        }

        // Try with explicit constraints - helps with some Brave configurations
        const constraints = {
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        };
        audioStream = await navigator.mediaDevices.getUserMedia(constraints);
        micPermissionGranted = true; // Mic permission was granted
        console.log('startRecording: mic permission granted');
        if (window.dbg) window.dbg('MIC GRANTED via startRecording');

        // iOS Safari: unlock audio context and speech synthesis on user gesture
        if (!window.audioUnlocked) {
          // Unlock Web Audio API
          const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
          const buffer = audioCtx.createBuffer(1, 1, 22050);
          const source = audioCtx.createBufferSource();
          source.buffer = buffer;
          source.connect(audioCtx.destination);
          source.start(0);

          // Also unlock speechSynthesis with a space character (empty string doesn't work on iOS)
          if (window.speechSynthesis) {
            const unlockUtterance = new SpeechSynthesisUtterance(' ');
            unlockUtterance.volume = 0.01;
            speechSynthesis.speak(unlockUtterance);
          }
          window.audioUnlocked = true;
        }

        let mimeType = 'audio/webm';
        if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4';
        } else if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
          mimeType = 'audio/webm;codecs=opus';
        }

        mediaRecorder = new MediaRecorder(audioStream, { mimeType });

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) audioChunks.push(event.data);
        };

        mediaRecorder.onstop = async () => {
          audioStream.getTracks().forEach(track => track.stop());
          audioStream = null;

          // If cancelled, don't process the audio
          if (recordingCancelled) {
            recordingCancelled = false;
            setButtonState('ready');
            return;
          }

          const audioBlob = new Blob(audioChunks, { type: mimeType });

          try {
            const wavBlob = await convertToWav(audioBlob);
            const base64Audio = await blobToBase64(wavBlob);
            // Save before upload in case of page refresh
            savePendingVoiceMessage(base64Audio);
            await sendAudioToAPI(base64Audio);
            // Clear on success
            clearPendingVoiceMessage();
          } catch (e) {
            console.error('Audio conversion error:', e);
            showError('Failed to process audio');
            setButtonState('ready');
          }
        };

        mediaRecorder.start();
        isListening = true;
        setButtonState('listening');

      } catch (error) {
        console.error('Microphone error:', error);
        showError('Microphone access denied');
        setButtonState('ready');
      }
    }

    function stopRecording() {
      if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
      }
      isListening = false;
      setButtonState('processing');
    }

    function cancelRecording() {
      recordingCancelled = true;
      if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
      }
      isListening = false;
    }

    function blobToBase64(blob) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    }

    async function convertToWav(audioBlob) {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const arrayBuffer = await audioBlob.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

      // Downsample to 16kHz for speech (Gemini downsamples anyway, saves bandwidth)
      const targetSampleRate = 16000;
      const resampledBuffer = await resampleAudio(audioContext, audioBuffer, targetSampleRate);

      const wavBuffer = audioBufferToWav(resampledBuffer, targetSampleRate);
      return new Blob([wavBuffer], { type: 'audio/wav' });
    }

    async function resampleAudio(audioContext, audioBuffer, targetSampleRate) {
      // If already at or below target rate, just return mono version
      if (audioBuffer.sampleRate <= targetSampleRate) {
        return audioBuffer;
      }

      // Create offline context at target sample rate
      const numSamples = Math.round(audioBuffer.duration * targetSampleRate);
      const offlineContext = new OfflineAudioContext(1, numSamples, targetSampleRate);

      // Create buffer source
      const source = offlineContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(offlineContext.destination);
      source.start(0);

      // Render resampled audio
      return await offlineContext.startRendering();
    }

    function audioBufferToWav(buffer, targetSampleRate) {
      const sampleRate = targetSampleRate || buffer.sampleRate;
      const format = 1;
      const bitDepth = 16;
      const numChannels = 1; // Always mono for speech

      // Get mono audio data (mix down if stereo)
      let samples;
      if (buffer.numberOfChannels === 2) {
        const left = buffer.getChannelData(0);
        const right = buffer.getChannelData(1);
        samples = new Float32Array(left.length);
        for (let i = 0; i < left.length; i++) {
          samples[i] = (left[i] + right[i]) / 2;
        }
      } else {
        samples = buffer.getChannelData(0);
      }

      const dataLength = samples.length * (bitDepth / 8);
      const wavBuffer = new ArrayBuffer(44 + dataLength);
      const view = new DataView(wavBuffer);

      writeString(view, 0, 'RIFF');
      view.setUint32(4, 36 + dataLength, true);
      writeString(view, 8, 'WAVE');
      writeString(view, 12, 'fmt ');
      view.setUint32(16, 16, true);
      view.setUint16(20, format, true);
      view.setUint16(22, numChannels, true);
      view.setUint32(24, sampleRate, true);
      view.setUint32(28, sampleRate * numChannels * (bitDepth / 8), true);
      view.setUint16(32, numChannels * (bitDepth / 8), true);
      view.setUint16(34, bitDepth, true);
      writeString(view, 36, 'data');
      view.setUint32(40, dataLength, true);

      for (let i = 0; i < samples.length; i++) {
        const sample = Math.max(-1, Math.min(1, samples[i]));
        view.setInt16(44 + i * 2, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
      }

      return wavBuffer;
    }

    function writeString(view, offset, string) {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    }

    // ============ Continuous Mode / VAD ============
    async function initializeVAD() {
      if (vadInstance) return vadInstance;

      // Check if VAD library is loaded
      if (typeof vad === 'undefined') {
        console.error('VAD library not loaded');
        showError('Voice detection unavailable');
        return null;
      }

      try {
        // Collect audio frames ourselves to handle misfires
        let collectedFrames = [];
        let isCollectingSpeech = false;
        let speechStartTime = 0;
        let pendingAudio = null;
        let pendingTimeout = null;

        // Adaptive pause detection based on industry research:
        // - Very short utterances (<600ms): likely "yes", "no" - send quickly
        // - Medium utterances (600ms-2s): might be complete thought - moderate wait
        // - Long utterances (>2s): likely thinking pause - wait longer
        const VERY_SHORT_UTTERANCE_MS = 600;
        const MEDIUM_UTTERANCE_MS = 2000;
        const VERY_SHORT_WAIT_MS = 400;    // Quick response for "yes/no"
        const MEDIUM_WAIT_MS = 2000;       // Moderate wait for medium speech
        const LONG_WAIT_MS = 4000;         // 4 seconds for extended speech with thinking pauses

        function processPendingAudio() {
          if (pendingAudio && isListening && continuousModeActive) {
            console.log('VAD: Processing pending audio after pause');
            stopContinuousModeRecording(pendingAudio);
          }
          pendingAudio = null;
          pendingTimeout = null;
        }

        function cancelPendingAudio() {
          if (pendingTimeout) {
            clearTimeout(pendingTimeout);
            pendingTimeout = null;
          }
          // Keep pendingAudio in case we need to combine it with new speech
        }

        vadInstance = await vad.MicVAD.new({
          positiveSpeechThreshold: 0.5,
          negativeSpeechThreshold: 0.15,
          redemptionFrames: 8,
          minSpeechFrames: 1,
          preSpeechPadFrames: 5,
          submitUserSpeechOnPause: false,

          onFrameProcessed: (probs, frame) => {
            // Collect frames while we think there's speech
            if (isCollectingSpeech) {
              collectedFrames.push(new Float32Array(frame));
            }
          },

          onSpeechStart: () => {
            console.log('VAD: Speech start detected');
            isCollectingSpeech = true;
            collectedFrames = [];

            // Cancel any pending send - user is speaking again
            cancelPendingAudio();

            // Check for mic bleed during detection window
            if (isDetectingBleed) {
              console.log('VAD: Mic bleed detected during TTS');
              if (window.dbg) window.dbg('BLEED RESULT: YES BLEED - interruption OFF');
              micBleedDetected = true;
              interruptionEnabled = false;
              isDetectingBleed = false;
              updateBleedStatus();
              isCollectingSpeech = false;
              return;
            }

            // Handle interruption if enabled and speaking
            if (interruptionEnabled && isSpeaking && !isListening) {
              console.log('VAD: User interruption detected');
              stopSpeaking();
              startRecording();
              isCollectingSpeech = false;
              return;
            }

            if (vadSuppressed || isSpeaking || !continuousModeActive) {
              isCollectingSpeech = false;
              return;
            }

            // If we had pending audio from a previous segment, we're continuing
            if (pendingAudio) {
              console.log('VAD: Continuing speech after pause');
              pendingAudio = null;  // Will be combined when this segment ends
            } else {
              speechStartTime = Date.now();
            }

            startContinuousModeRecording();
          },

          onSpeechEnd: (audio) => {
            console.log('VAD: Speech end detected');
            isCollectingSpeech = false;

            if (vadSuppressed || isSpeaking || !continuousModeActive) {
              collectedFrames = [];
              return;
            }
            if (!isListening) {
              collectedFrames = [];
              return;
            }

            // Combine with any pending audio from previous segments
            let finalAudio = audio;
            if (pendingAudio) {
              const combined = new Float32Array(pendingAudio.length + audio.length);
              combined.set(pendingAudio, 0);
              combined.set(audio, pendingAudio.length);
              finalAudio = combined;
              console.log('VAD: Combined audio segments, total length:', finalAudio.length);
            }

            const speechDuration = Date.now() - speechStartTime;
            console.log('VAD: Speech duration:', speechDuration, 'ms');

            // Adaptive wait time based on utterance length
            let waitTime;
            if (speechDuration < VERY_SHORT_UTTERANCE_MS) {
              // Very short utterance (<600ms) - likely "yes", "no", "okay"
              waitTime = VERY_SHORT_WAIT_MS;
              console.log('VAD: Very short utterance, waiting', waitTime, 'ms');
            } else if (speechDuration < MEDIUM_UTTERANCE_MS) {
              // Medium utterance (600ms-2s) - probably complete thought
              waitTime = MEDIUM_WAIT_MS;
              console.log('VAD: Medium utterance, waiting', waitTime, 'ms');
            } else {
              // Long utterance (>2s) - might be thinking pause
              waitTime = LONG_WAIT_MS;
              console.log('VAD: Long utterance, waiting', waitTime, 'ms');
            }

            pendingAudio = finalAudio;
            collectedFrames = [];
            pendingTimeout = setTimeout(processPendingAudio, waitTime);
          },

          onVADMisfire: () => {
            console.log('VAD: Misfire - using collected frames instead');
            if (window.dbg) window.dbg('VAD MISFIRE - using ' + collectedFrames.length + ' frames');
            isCollectingSpeech = false;

            // Use our collected frames instead of discarding
            if (collectedFrames.length > 0 && isListening && continuousModeActive) {
              // Concatenate all frames into one Float32Array
              const totalLength = collectedFrames.reduce((sum, f) => sum + f.length, 0);
              const combinedAudio = new Float32Array(totalLength);
              let offset = 0;
              for (const frame of collectedFrames) {
                combinedAudio.set(frame, offset);
                offset += frame.length;
              }
              console.log('VAD: Processing misfire audio, length:', combinedAudio.length);
              // Treat misfire same as short utterance - send immediately
              stopContinuousModeRecording(combinedAudio);
            }
            collectedFrames = [];
          }
        });

        // VAD initialized successfully means mic permission was granted
        micPermissionGranted = true;
        console.log('VAD initialized, mic permission granted');
        if (window.dbg) window.dbg('MIC GRANTED via VAD init');
        return vadInstance;
      } catch (error) {
        console.error('Failed to initialize VAD:', error);
        showError('Voice detection failed to initialize');
        return null;
      }
    }

    // Start bleed detection during first TTS response
    async function startBleedDetection() {
      if (micBleedDetected !== null) {
        console.log('Bleed detection: already tested');
        return;
      }

      // Can't run bleed detection until mic permission has been granted
      // (VAD needs mic access which requires user gesture on mobile)
      console.log('startBleedDetection: micPermissionGranted =', micPermissionGranted);
      if (window.dbg) window.dbg('BLEED CHECK: micPermissionGranted=' + micPermissionGranted);
      if (!micPermissionGranted) {
        console.log('Bleed detection skipped - mic permission not yet granted');
        if (window.dbg) window.dbg('BLEED SKIPPED - no mic');
        updateBleedStatus('no-mic');
        return;
      }

      // Initialize VAD if needed (for bleed detection even outside continuous mode)
      if (!vadInstance) {
        updateBleedStatus('init-vad');
        const vadReady = await initializeVAD();
        if (!vadReady) {
          console.log('Could not initialize VAD for bleed detection');
          updateBleedStatus('vad-failed');
          return;
        }
      }

      console.log('Starting mic bleed detection...');
      if (window.dbg) window.dbg('BLEED DETECTING...');
      isDetectingBleed = true;
      updateBleedStatus('detecting');
      vadInstance.start();

      // After detection window, if no bleed detected, enable interruption
      setTimeout(() => {
        if (isDetectingBleed) {
          // No bleed detected during window
          isDetectingBleed = false;
          micBleedDetected = false;
          interruptionEnabled = true;
          console.log('No mic bleed detected - interruption enabled');
          if (window.dbg) window.dbg('BLEED RESULT: NO BLEED - interruption ON');
          updateBleedStatus();
        }
        // Keep VAD running for interruption if enabled, otherwise pause
        if (!interruptionEnabled && !continuousModeActive) {
          vadInstance.pause();
        }
      }, BLEED_DETECTION_WINDOW_MS);
    }

    // Update UI to show bleed detection status
    function updateBleedStatus(state = null) {
      const statusDiv = document.getElementById('bleedStatus');
      if (!statusDiv) return;

      // Debug states
      if (state === 'no-mic') {
        statusDiv.textContent = 'Bleed: waiting for mic';
        statusDiv.style.color = '';
      } else if (state === 'init-vad') {
        statusDiv.textContent = 'Bleed: init VAD...';
        statusDiv.style.color = '';
      } else if (state === 'vad-failed') {
        statusDiv.textContent = 'Bleed: VAD failed';
        statusDiv.style.color = 'var(--error)';
      } else if (state === 'detecting') {
        statusDiv.textContent = 'Detecting audio...';
        statusDiv.style.color = '';
      } else if (micBleedDetected === true) {
        statusDiv.textContent = 'Bleed: yes (tap to interrupt)';
        statusDiv.style.color = '';
      } else if (micBleedDetected === false) {
        statusDiv.textContent = 'Bleed: no (voice interrupts)';
        statusDiv.style.color = '';
      } else {
        statusDiv.textContent = ''; // Hide when empty
      }
    }

    function startContinuousModeRecording() {
      if (isListening) return;
      audioChunks = [];
      isListening = true;
      setButtonState('continuous-listening');
    }

    async function stopContinuousModeRecording(vadAudio) {
      if (!isListening) return;
      isListening = false;
      setButtonState('processing');

      // Suppress VAD before processing (will resume after TTS)
      suppressVAD();

      try {
        // Convert VAD Float32Array (16kHz) to WAV
        const wavBlob = float32ToWav(vadAudio, 16000);
        const base64Audio = await blobToBase64(wavBlob);

        savePendingVoiceMessage(base64Audio);
        await sendAudioToAPI(base64Audio);
        clearPendingVoiceMessage();
      } catch (error) {
        console.error('Continuous mode processing error:', error);
        showError('Failed to process speech');
        // Quick resume on error
        resumeVADAfterDelay(100);
      }
    }

    function float32ToWav(samples, sampleRate) {
      const numChannels = 1;
      const bitDepth = 16;
      const dataLength = samples.length * (bitDepth / 8);
      const wavBuffer = new ArrayBuffer(44 + dataLength);
      const view = new DataView(wavBuffer);

      writeString(view, 0, 'RIFF');
      view.setUint32(4, 36 + dataLength, true);
      writeString(view, 8, 'WAVE');
      writeString(view, 12, 'fmt ');
      view.setUint32(16, 16, true);
      view.setUint16(20, 1, true);
      view.setUint16(22, numChannels, true);
      view.setUint32(24, sampleRate, true);
      view.setUint32(28, sampleRate * numChannels * (bitDepth / 8), true);
      view.setUint16(32, numChannels * (bitDepth / 8), true);
      view.setUint16(34, bitDepth, true);
      writeString(view, 36, 'data');
      view.setUint32(40, dataLength, true);

      for (let i = 0; i < samples.length; i++) {
        const sample = Math.max(-1, Math.min(1, samples[i]));
        view.setInt16(44 + i * 2, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
      }

      return new Blob([wavBuffer], { type: 'audio/wav' });
    }

    function suppressVAD() {
      if (!vadInstance || vadSuppressed) return;
      vadSuppressed = true;
      vadInstance.pause();
      console.log('VAD: Suppressed');
    }

    function resumeVAD() {
      if (!vadInstance || !vadSuppressed || !continuousModeActive) return;
      vadSuppressed = false;
      vadInstance.start();
      setButtonState('continuous-ready');
      console.log('VAD: Resumed');
    }

    function resumeVADAfterDelay(delayMs = SPEECH_END_BUFFER_MS) {
      setTimeout(() => {
        if (continuousModeActive && !isSpeaking) {
          resumeVAD();
        }
      }, delayMs);
    }

    async function enterContinuousMode() {
      // Cancel any current recording
      if (isListening) {
        cancelRecording();
      }

      // Stop any current speech
      if (isSpeaking) {
        stopSpeaking();
      }

      // Initialize VAD if needed
      const vadReady = await initializeVAD();
      if (!vadReady) {
        showError('Could not start continuous mode');
        return;
      }

      continuousModeActive = true;
      vadSuppressed = false;
      setButtonState('continuous-ready');
      vadInstance.start();

      // Update UI
      mainButton.classList.add('continuous-mode');
      exitContinuousBtn.classList.remove('hidden');
    }

    function exitContinuousMode() {
      if (!continuousModeActive) return;

      continuousModeActive = false;

      // Stop VAD
      if (vadInstance) {
        vadInstance.pause();
        vadSuppressed = true;
      }

      // Cancel any ongoing recording
      if (isListening) {
        cancelRecording();
      }

      // Update UI
      mainButton.classList.remove('continuous-mode');
      exitContinuousBtn.classList.add('hidden');
      setButtonState('ready');
    }

    // ============ Tool Calling ============
    function parseToolCall(response) {
      // Look for ```tool_call\n{...}\n``` pattern
      const match = response.match(/```tool_call\s*\n([\s\S]*?)\n```/);
      if (!match) return null;

      try {
        const toolCall = JSON.parse(match[1].trim());
        if (toolCall.tool && typeof toolCall.tool === 'string') {
          return toolCall;
        }
      } catch (e) {
        console.warn('Failed to parse tool call:', e);
      }
      return null;
    }

    async function executeWebSearchText(userText, systemPrompt) {
      // Make a request with the :online model for web search
      const response = await fetch(`${OPENROUTER_API_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': window.location.origin,
          'X-Title': 'Spraff'
        },
        body: JSON.stringify({
          model: MODEL_ONLINE,
          stream: true,
          messages: [
            { role: 'system', content: systemPrompt + '\n\nWeb search is ENABLED for this query. You have access to current information from the web. Provide a helpful response using the search results.' },
            ...conversationHistory,
            { role: 'user', content: userText }
          ],
          provider: {
            only: ['google-vertex'],
            allow_fallbacks: false,
            zdr: true
          }
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'API request failed');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullResponse = '';
      let buffer = '';
      let usage = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine || !trimmedLine.startsWith('data: ')) continue;

          const data = trimmedLine.slice(6);
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            if (parsed.usage) usage = parsed.usage;

            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              fullResponse += content;
              updateStreamingMessage(fullResponse);
            }
          } catch (e) {}
        }
      }

      return { fullResponse, usage };
    }

    async function executeWebSearchVoice(base64Audio, systemPrompt) {
      const response = await fetch(`${OPENROUTER_API_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': window.location.origin,
          'X-Title': 'Spraff'
        },
        body: JSON.stringify({
          model: MODEL_ONLINE,
          stream: true,
          messages: [
            { role: 'system', content: systemPrompt + '\n\nWeb search is ENABLED for this query. You have access to current information from the web. Provide a helpful response using the search results.' },
            ...conversationHistory,
            {
              role: 'user',
              content: [
                { type: 'input_audio', input_audio: { data: base64Audio, format: 'wav' } }
              ]
            }
          ],
          provider: {
            only: ['google-vertex'],
            allow_fallbacks: false,
            zdr: true
          }
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'API request failed');
      }

      // Stream the response
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullResponse = '';
      let buffer = '';
      let usage = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine || !trimmedLine.startsWith('data: ')) continue;

          const data = trimmedLine.slice(6);
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            if (parsed.usage) usage = parsed.usage;

            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              fullResponse += content;
            }
          } catch (e) {}
        }
      }

      return { fullResponse, usage };
    }

    // ============ API Communication ============
    function getModel() {
      return MODEL;
    }

    function buildSystemPrompt() {
      const today = new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      return `You are a helpful assistant that can communicate via voice or text. Today is ${today}.

The user is currently in VOICE MODE - they spoke this message aloud and your response will be read aloud via text-to-speech. Previous messages in the conversation may have been via text or voice.

NOTE: The technical details in this system prompt (about voice mode, text-to-speech, etc.) are about HOW to format your response, not WHAT to talk about. Answer the user's actual question - don't let these instructions bias your content toward tech topics.

CRITICAL REQUIREMENTS:

1. TRANSCRIPTION: You MUST ALWAYS start your response by transcribing exactly what the user said in their audio message using [USER]...[/USER] tags. Listen carefully to their audio and write what they said:

[USER]
<transcribe the user's spoken words here>
[/USER]

<your response here>

2. SPEECH-FRIENDLY OUTPUT: Your response will be converted to speech, so you MUST:
- Be concise and conversational
- NEVER include URLs or links - they sound terrible spoken aloud. Describe sources naturally, e.g. "according to Simon Willison's blog" not "according to simonwillison.net"
- NEVER use domain names like ".com", ".io", ".net", etc.
- Avoid all technical formatting, code, or special characters
- No lists or bullet points - use flowing sentences instead

3. TOOLS: You have access to a web_search tool. To use it, include the following AFTER your [USER] transcript:

\`\`\`tool_call
{"tool": "web_search"}
\`\`\`

ONLY use web_search when you are CERTAIN the user needs current, real-time information (news, weather, stock prices, sports scores, recent events). Do NOT use it for general knowledge. If unsure, just ask if they'd like you to search.

Respond naturally as if having a spoken conversation.`;
    }

    async function sendAudioToAPI(base64Audio) {
      shouldStopSpeaking = false;
      speechQueue = [];

      // Calculate and store voice message size (base64 to bytes: ~75% of base64 length)
      const audioSizeBytes = Math.round(base64Audio.length * 0.75);
      stats.lastVoiceSize = audioSizeBytes;

      // Build request body
      const requestBody = JSON.stringify({
        model: getModel(),
        stream: true,
        messages: [
          { role: 'system', content: buildSystemPrompt() },
          ...conversationHistory,
          {
            role: 'user',
            content: [
              { type: 'input_audio', input_audio: { data: base64Audio, format: 'wav' } }
            ]
          }
        ],
        provider: {
          only: ['google-vertex'],
          allow_fallbacks: false,
          zdr: true
        }
      });

      const payloadSize = new Blob([requestBody]).size;
      const payloadSizeKB = Math.round(payloadSize / 1024);

      // Show uploading status
      statusText.textContent = `Uploading ${payloadSizeKB} KB`;

      try {
        const response = await fetch(`${OPENROUTER_API_URL}/chat/completions`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': window.location.origin,
            'X-Title': 'Spraff'
          },
          body: requestBody
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error?.message || 'API request failed');
        }

        statusText.textContent = 'Thinking';

        // Stream the response
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullResponse = '';
        let buffer = '';
        let usage = null;
        let userTranscript = null;
        let transcriptExtracted = false;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine || !trimmedLine.startsWith('data: ')) continue;

            const data = trimmedLine.slice(6);
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);
              if (parsed.usage) usage = parsed.usage;

              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                fullResponse += content;

                // Extract user transcript
                if (!transcriptExtracted) {
                  const match = fullResponse.match(/\[USER\]\s*([\s\S]*?)\s*\[\/USER\]/);
                  if (match) {
                    userTranscript = match[1].trim();
                    transcriptExtracted = true;
                  }
                }
              }
            } catch (e) {}
          }
        }

        // Get the response text (after transcript)
        let responseOnly = fullResponse;
        const endTagIndex = fullResponse.indexOf('[/USER]');
        if (endTagIndex !== -1) {
          responseOnly = fullResponse.slice(endTagIndex + 7).trim();
        }

        // Check for tool calls
        const toolCall = parseToolCall(responseOnly);
        // Also check the full response in case the tool call came without transcript tags
        const toolCallFromFull = !toolCall ? parseToolCall(fullResponse) : null;
        const detectedToolCall = toolCall || toolCallFromFull;

        if (detectedToolCall && detectedToolCall.tool === 'web_search') {
          // If we don't have a transcript, we can't proceed with search in voice mode
          if (!userTranscript) {
            console.warn('Web search requested but no transcript available');
            showError('Could not process voice search request');
            setButtonState('ready');
            stopBtn.classList.add('hidden');
            return;
          }

          // Show searching status and speak it
          statusText.textContent = 'Searching';
          setButtonState('speaking');

          // Speak the searching message and wait for it to finish
          await new Promise((resolve) => {
            const utterance = new SpeechSynthesisUtterance('Searching the web, please wait.');
            utterance.rate = 1.1;
            // Use the selected voice if available
            if (selectedVoiceName) {
              const voices = speechSynthesis.getVoices();
              const voice = voices.find(v => v.name === selectedVoiceName);
              if (voice) utterance.voice = voice;
            }
            utterance.onend = resolve;
            utterance.onerror = resolve;
            speechSynthesis.speak(utterance);
          });

          try {
            // Execute web search with the transcript as text (not audio)
            // Use a simplified voice-friendly system prompt without transcript tags
            const searchResult = await executeWebSearchText(userTranscript, buildVoiceSearchSystemPrompt());

            // Update stats (include both requests)
            if (usage && typeof usage.cost === 'number') {
              updateSessionCost(usage.cost);
            }
            if (searchResult.usage && typeof searchResult.usage.cost === 'number') {
              updateSessionCost(searchResult.usage.cost);
            }

            // Now speak the search response
            setButtonState('speaking');
            stopBtn.classList.remove('hidden');

            const sentences = searchResult.fullResponse.match(/[^.!?]+[.!?]+/g) || [searchResult.fullResponse];
            for (let i = 0; i < sentences.length; i++) {
              queueSpeech(sentences[i].trim(), i === 0);
            }

            // Save to conversation history
            conversationHistory.push({ role: 'user', content: userTranscript });
            conversationHistory.push({ role: 'assistant', content: searchResult.fullResponse });
            saveConversationHistory();
                } catch (searchError) {
            console.error('Web search error:', searchError);
            showError('Web search failed: ' + searchError.message);
            setButtonState('ready');
            stopBtn.classList.add('hidden');
          }
        } else {
          // Normal response - speak it
          setButtonState('speaking');
          stopBtn.classList.remove('hidden');

          // Queue speech for the entire response, sentence by sentence
          const sentences = responseOnly.match(/[^.!?]+[.!?]+/g) || [responseOnly];
          for (let i = 0; i < sentences.length; i++) {
            queueSpeech(sentences[i].trim(), i === 0);
          }

          // Update stats from API response
          if (usage && typeof usage.cost === 'number') {
            updateSessionCost(usage.cost);
          }

          // Save to conversation history (keep speech hints for display)
          conversationHistory.push({ role: 'user', content: userTranscript || '[voice message]' });
          conversationHistory.push({ role: 'assistant', content: responseOnly });
          saveConversationHistory();
            }

      } catch (error) {
        console.error('API error:', error);
        showError(error.message);
        setButtonState('ready');
        stopBtn.classList.add('hidden');
      }
    }

    function buildVoiceSearchSystemPrompt() {
      const today = new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      return `You are a helpful assistant. Today is ${today}.

Your response will be read aloud via text-to-speech.

Web search is ENABLED for this query. You have access to current information from the web. Provide a helpful response using the search results.

SPEECH-FRIENDLY OUTPUT: Your response will be converted to speech, so you MUST:
- Be concise and conversational
- NEVER include URLs or links - they sound terrible spoken aloud. Describe sources naturally, e.g. "according to Simon Willison's blog" not "according to simonwillison.net"
- NEVER use domain names like ".com", ".io", ".net", etc.
- Avoid all technical formatting, code, or special characters
- No lists or bullet points - use flowing sentences instead

Respond naturally as if having a spoken conversation.`;
    }

    function buildTextSystemPrompt() {
      const today = new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      return `You are a helpful assistant that can communicate via voice or text. Today is ${today}.

The user is currently in TEXT MODE - they typed this message and will read your response on screen. Previous messages in the conversation may have been via text or voice.

## Tools

You have access to tools that run in the user's browser. To use a tool, respond with ONLY a JSON code block in this format:

\`\`\`tool_call
{"tool": "tool_name", "args": {...}}
\`\`\`

When you use a tool, do not include any other text in your response - just the tool call block.

### Available Tools

**web_search**
- Description: Routes the user's query to a search-enabled model that can access current information from the web.
- Arguments: none
- When to use: ONLY use this tool when you are CERTAIN the user needs current, real-time information that you cannot provide from your training data. Examples:
  - User explicitly asks to search: "search for...", "look up...", "find me..."
  - Current events: "what's in the news today", "latest on..."
  - Real-time data: weather, stock prices, sports scores, election results
  - Recent releases: "what's the newest iPhone", "latest software version"
- When NOT to use: Do NOT use for general knowledge questions, historical facts, explanations, coding help, or anything you can answer from your training data. Web searches are expensive (2.5 cents each vs fractions of a cent for regular queries), so use them conservatively.
- If unsure: Ask the user "Would you like me to search the web for that?" rather than automatically searching.

Because this response will be read on screen, you can use:
- Markdown formatting (bold, lists, code blocks) when helpful
- URLs and links if relevant
- Technical details and code snippets if appropriate

Be concise and direct in your responses. Focus on being helpful and informative.`;
    }

    async function sendTextToAPI(userText) {
      if (!userText.trim() || isProcessingText) return;

      // Test feature: NNNw generates NNN words on a random topic
      const wordMatch = userText.trim().match(/^(\d+)w$/);
      if (wordMatch) {
        const wordCount = parseInt(wordMatch[1], 10);
        userText = `Write exactly ${wordCount} words on a random interesting topic. Pick something unexpected and engaging.`;
      }

      isProcessingText = true;
      textSendBtn.classList.add('loading');
      textInput.disabled = true;
      stopBtn.classList.remove('hidden');

      // Add user message to UI
      addMessageToHistory('user', userText);

      // Start streaming response
      addMessageToHistory('assistant', '', true);

      try {
        const response = await fetch(`${OPENROUTER_API_URL}/chat/completions`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': window.location.origin,
            'X-Title': 'Spraff'
          },
          body: JSON.stringify({
            model: getModel(),
            stream: true,
            messages: [
              { role: 'system', content: buildTextSystemPrompt() },
              ...conversationHistory,
              { role: 'user', content: userText }
            ],
            provider: {
              only: ['google-vertex'],
              allow_fallbacks: false,
              zdr: true
            }
          })
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error?.message || 'API request failed');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullResponse = '';
        let buffer = '';
        let usage = null;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine || !trimmedLine.startsWith('data: ')) continue;

            const data = trimmedLine.slice(6);
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);
              if (parsed.usage) usage = parsed.usage;

              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                fullResponse += content;
                // Check if this looks like a tool call starting - don't display it
                if (!fullResponse.includes('```tool_call')) {
                  updateStreamingMessage(fullResponse);
                } else {
                  // Show searching message as soon as we detect tool call
                  updateStreamingMessage('*Searching the web...*');
                }
              }
            } catch (e) {}
          }
        }

        // Check for tool calls before finishing
        const toolCall = parseToolCall(fullResponse);
        if (toolCall && toolCall.tool === 'web_search') {
          try {
            // Execute web search with :online model
            const searchResult = await executeWebSearchText(userText, buildTextSystemPrompt());

            // Update the streaming message with search results
            updateStreamingMessage(searchResult.fullResponse);
            finishStreamingMessage();

            // Update stats (include both requests)
            if (usage && typeof usage.cost === 'number') {
              updateSessionCost(usage.cost);
            }
            if (searchResult.usage && typeof searchResult.usage.cost === 'number') {
              updateSessionCost(searchResult.usage.cost);
            }

            // Save to conversation history (only save the final search result, not the tool call)
            conversationHistory.push({ role: 'user', content: userText });
            conversationHistory.push({ role: 'assistant', content: searchResult.fullResponse });
            saveConversationHistory();
                } catch (searchError) {
            console.error('Web search error:', searchError);
            showError('Web search failed: ' + searchError.message);
            finishStreamingMessage();
          }
        } else {
          finishStreamingMessage();

          // Update stats
          if (usage && typeof usage.cost === 'number') {
            updateSessionCost(usage.cost);
          }

          // Save to conversation history
          conversationHistory.push({ role: 'user', content: userText });
          conversationHistory.push({ role: 'assistant', content: fullResponse });
          saveConversationHistory();
            }

      } catch (error) {
        console.error('API error:', error);
        showError(error.message);
        finishStreamingMessage();
        // Remove the empty assistant message if we failed
        const lastGroup = conversationHistoryEl.lastElementChild;
        if (lastGroup) {
          const assistantEl = lastGroup.querySelector('.message.assistant');
          if (assistantEl && !assistantEl.textContent) {
            assistantEl.remove();
          }
        }
      } finally {
        isProcessingText = false;
        textSendBtn.classList.remove('loading');
        textInput.disabled = false;
        // Only auto-focus on desktop to avoid keyboard popping up on mobile
        if (!isMobile) {
          textInput.focus();
        }
        stopBtn.classList.add('hidden');
      }
    }

    // ============ Text Processing ============
    function sanitizeForSpeech(text) {
      return text
        .replace(/^#{1,6}\s+/gm, '')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .replace(/https?:\/\/[^\s)]+/g, '')
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/\*([^*]+)\*/g, '$1')
        .replace(/__([^_]+)__/g, '$1')
        .replace(/_([^_]+)_/g, '$1')
        .replace(/```[\s\S]*?```/g, '')
        .replace(/`([^`]+)`/g, '$1')
        .replace(/^>\s*/gm, '')
        .replace(/^[-*+]\s+/gm, ', ')
        .replace(/^\d+\.\s+/gm, ', ')
        .replace(/\s+/g, ' ')
        .trim();
    }

    // ============ Text-to-Speech ============
    function queueSpeech(text, isFirst = false) {
      if (!text.trim() || shouldStopSpeaking) return;
      const sanitized = sanitizeForSpeech(text);
      if (!sanitized) return;

      // Track total characters for progress
      if (isFirst) {
        speechTotalChars = 0;
        speechSpokenChars = 0;
      }
      speechTotalChars += sanitized.length;

      speechQueue.push(sanitized);
      if (!isSpeaking) processQueue();
    }

    function processQueue() {
      if (shouldStopSpeaking || speechQueue.length === 0) {
        isSpeaking = false;
        if (speechQueue.length === 0) {
          stopBtn.classList.add('hidden');
          // Resume VAD after TTS completes (with buffer delay)
          if (continuousModeActive) {
            resumeVADAfterDelay();
          } else {
            setButtonState('ready');
          }
        }
        return;
      }

      isSpeaking = true;

      // Suppress VAD while speaking, UNLESS interruption is enabled (no bleed detected)
      if (continuousModeActive && !interruptionEnabled) {
        suppressVAD();
      } else if (interruptionEnabled && vadInstance) {
        // Make sure VAD is running for voice interruption
        vadInstance.start();
        if (window.dbg) window.dbg('VAD running for interruption during TTS');
      }
      const text = speechQueue.shift();
      const textLength = text.length;

      if (!window.speechSynthesis) {
        speechSpokenChars += textLength;
        processQueue();
        return;
      }

      // iOS Safari workaround: cancel any pending speech first
      speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1;
      utterance.pitch = 1;
      utterance.volume = 1;

      // Select voice
      const voices = speechSynthesis.getVoices();
      let voice = null;

      if (selectedVoiceName) {
        voice = voices.find(v => v.name === selectedVoiceName);
      }

      // Fallback to default voice if selected not found
      if (!voice) {
        voice = getDefaultVoice(voices);
      }

      if (voice) {
        utterance.voice = voice;
      }

      // iOS Safari fix: onend often doesn't fire, use timeout as fallback
      let ended = false;
      const markEnded = () => {
        if (ended) return;
        ended = true;
        speechSpokenChars += textLength;
        processQueue();
      };

      utterance.onend = markEnded;
      utterance.onerror = markEnded;

      // Fallback timeout for iOS
      const estimatedDuration = Math.max(2000, text.length * 80);
      setTimeout(() => {
        if (!ended && isSpeaking) {
          console.warn('Speech timeout fallback triggered');
          markEnded();
        }
      }, estimatedDuration);

      // iOS Safari: need to resume in case it's paused
      speechSynthesis.resume();
      speechSynthesis.speak(utterance);

      // Start bleed detection on first TTS (only once per session)
      if (micBleedDetected === null) {
        console.log('First TTS - starting bleed detection');
        // Debug: show immediate status
        const statusDiv = document.getElementById('bleedStatus');
        if (statusDiv) statusDiv.textContent = 'TTS started...';
        startBleedDetection();
      } else if (interruptionEnabled && vadInstance) {
        // Restart VAD for voice interruption on subsequent TTS
        if (window.dbg) window.dbg('Restarting VAD for interruption');
        vadInstance.start();
      }
    }

    function stopSpeaking() {
      shouldStopSpeaking = true;
      speechQueue = [];
      speechSynthesis.cancel();
      isSpeaking = false;
      stopBtn.classList.add('hidden');

      // Resume VAD if in continuous mode (short delay when user stops)
      if (continuousModeActive) {
        resumeVADAfterDelay(100);
      } else {
        setButtonState('ready');
      }
    }

    // ============ Voice Settings ============
    function isCloudVoice(voice) {
      return voice.localService === false;
    }

    // Recommended voices - high quality on-device voices
    const recommendedVoices = [
      'Samantha (Enhanced)', 'Ava (Premium)', 'Zoe (Premium)', 'Tom (Enhanced)',
      'Serena (Premium)', 'Daniel (Enhanced)', 'Karen (Enhanced)',
      'Google UK English Female', 'Google UK English Male', 'Google US English',
      // Windows natural voices
      'Microsoft Jenny', 'Microsoft Aria', 'Microsoft Guy'
    ];

    // Low quality, novelty, or problematic voices to filter out
    const voiceBlacklist = [
      // Apple Novelty/Effects voices
      'Albert', 'Bad News', 'Bahh', 'Bells', 'Boing', 'Bubbles', 'Cellos',
      'Deranged', 'Fred', 'Good News', 'Hysterical', 'Jester', 'Junior',
      'Kathy', 'Organ', 'Superstar', 'Trinoids', 'Whisper', 'Wobble',
      'Zarvox', 'Ralph', 'Agnes', 'Bruce', 'Vicki', 'Victoria', 'Princess',
      // Apple Eloquence voices (robotic)
      'Eddy', 'Flo', 'Grandma', 'Grandpa', 'Reed', 'Rocko', 'Sandy', 'Shelley',
      // eSpeak voices
      'eSpeak', 'espeak'
    ];

    function isBlacklisted(voice) {
      const name = voice.name;
      return voiceBlacklist.some(blocked => name.includes(blocked));
    }

    function isRecommended(voice) {
      return recommendedVoices.some(name => voice.name.includes(name));
    }

    // Get the default voice using the same logic as processQueue
    function getDefaultVoice(voices) {
      const preferredLocal = [
        'Ava (Premium)', 'Ava', 'Samantha (Enhanced)', 'Zoe (Premium)', 'Tom (Enhanced)',
        'Serena (Premium)', 'Daniel (Enhanced)', 'Karen (Enhanced)', 'Alex',
        'Samantha', 'Daniel', 'Karen', 'Moira', 'Tessa'
      ];

      for (const name of preferredLocal) {
        const voice = voices.find(v => v.name.includes(name) && v.localService !== false);
        if (voice) return voice;
      }

      // Fallback to any English local voice
      let voice = voices.find(v => v.lang.startsWith('en') && v.localService !== false);
      if (voice) return voice;

      // Last resort: any English voice
      return voices.find(v => v.lang.startsWith('en'));
    }

    // Initialize default voice at startup
    function initDefaultVoice() {
      if (selectedVoiceName) return; // Already have a selection

      const voices = speechSynthesis.getVoices();
      const englishVoices = voices.filter(v => v.lang.startsWith('en'));
      if (englishVoices.length === 0) return;

      const defaultVoice = getDefaultVoice(englishVoices);
      if (defaultVoice) {
        selectedVoiceName = defaultVoice.name;
        localStorage.setItem('selectedVoice', defaultVoice.name);
      }
    }

    function populateVoiceList() {
      const voices = speechSynthesis.getVoices();

      // If voices aren't loaded yet, wait for them
      if (voices.length === 0) {
        return;
      }

      let englishVoices = voices.filter(v => v.lang.startsWith('en'));

      // Filter out blacklisted low-quality/novelty voices
      englishVoices = englishVoices.filter(v => !isBlacklisted(v));

      // Deduplicate voices with the same name (macOS returns duplicates at different quality levels)
      const seenNames = new Set();
      englishVoices = englishVoices.filter(v => {
        if (seenNames.has(v.name)) return false;
        seenNames.add(v.name);
        return true;
      });

      // Ensure we have a default voice selected
      initDefaultVoice();

      // Filter out cloud voices if toggle is off
      if (!cloudVoicesEnabled) {
        englishVoices = englishVoices.filter(v => !isCloudVoice(v));
      }

      // Check if any cloud voices exist
      const allVoices = speechSynthesis.getVoices();
      const hasCloudVoices = allVoices.some(v => v.lang.startsWith('en') && isCloudVoice(v));

      // Sort: Recommended first, then Cloud (if enabled), then Premium/Enhanced, then alphabetical
      englishVoices.sort((a, b) => {
        const aRec = isRecommended(a);
        const bRec = isRecommended(b);
        // Recommended voices at the very top
        if (aRec && !bRec) return -1;
        if (!aRec && bRec) return 1;
        const aCloud = isCloudVoice(a);
        const bCloud = isCloudVoice(b);
        // Cloud voices next when enabled
        if (aCloud && !bCloud) return -1;
        if (!aCloud && bCloud) return 1;
        const aPremium = a.name.includes('Premium') || a.name.includes('Enhanced');
        const bPremium = b.name.includes('Premium') || b.name.includes('Enhanced');
        if (aPremium && !bPremium) return -1;
        if (!aPremium && bPremium) return 1;
        return a.name.localeCompare(b.name);
      });

      voiceList.innerHTML = '';

      // Update toggle state and visibility
      const toggle = document.getElementById('cloudVoicesToggle');
      const toggleContainer = document.querySelector('.cloud-toggle');
      if (toggle) toggle.checked = cloudVoicesEnabled;
      if (toggleContainer) toggleContainer.style.display = hasCloudVoices ? '' : 'none';

      // Update current voice display
      const currentVoiceEl = document.getElementById('currentVoiceName');
      if (currentVoiceEl) {
        currentVoiceEl.textContent = selectedVoiceName || 'None selected';
      }

      englishVoices.forEach(voice => {
        const isSelected = selectedVoiceName === voice.name;
        const isCloud = isCloudVoice(voice);
        const isRec = isRecommended(voice);
        const item = document.createElement('div');
        item.className = `voice-item${isSelected ? ' selected' : ''}`;
        item.dataset.voiceName = voice.name;

        let badges = '';
        if (isRec) badges += '<span class="voice-recommended-badge">recommended</span>';
        if (isCloud) badges += '<span class="voice-cloud-badge">cloud</span>';

        item.innerHTML = `
          <div class="voice-radio"></div>
          <div class="voice-info">
            <div class="voice-name">${voice.name}${badges}</div>
            <div class="voice-lang">${voice.lang}</div>
          </div>
          <button class="voice-preview">Preview</button>
        `;

        item.addEventListener('click', (e) => {
          if (e.target.classList.contains('voice-preview')) return;
          selectVoice(voice.name);
        });

        item.querySelector('.voice-preview').addEventListener('click', (e) => {
          e.stopPropagation();
          previewVoice(voice);
        });

        voiceList.appendChild(item);
      });
    }

    function selectVoice(voiceName) {
      selectedVoiceName = voiceName;
      localStorage.setItem('selectedVoice', voiceName);
      document.querySelectorAll('.voice-item').forEach(item => {
        const name = item.dataset.voiceName;
        item.classList.toggle('selected', name === voiceName);
      });
      // Update current voice display
      const currentVoiceEl = document.getElementById('currentVoiceName');
      if (currentVoiceEl) {
        currentVoiceEl.textContent = voiceName;
      }
    }

    function previewVoice(voice) {
      speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance("Hello! I'm your voice assistant.");
      utterance.voice = voice;
      speechSynthesis.speak(utterance);
    }

    function openVoiceSettings() {
      voiceModal.classList.remove('hidden');

      // Try to populate immediately
      populateVoiceList();

      // If voices weren't ready, wait for them
      const voices = speechSynthesis.getVoices();
      if (voices.length === 0) {
        // Set up a one-time handler to populate when voices load
        const onVoicesReady = () => {
          populateVoiceList();
          speechSynthesis.removeEventListener('voiceschanged', onVoicesReady);
        };
        speechSynthesis.addEventListener('voiceschanged', onVoicesReady);
      }
    }

    function closeVoiceSettings() {
      speechSynthesis.cancel();
      voiceModal.classList.add('hidden');
    }

    // ============ Event Listeners ============
    function setupEventListeners() {
      console.log('setupEventListeners START');
      loginBtn.addEventListener('click', startOAuthFlow);
      logoutBtn.addEventListener('click', () => {
        settingsDropdown.classList.remove('open');
        logout();
      });

      // Main button - tap to toggle recording, hold to enter continuous mode
      let buttonPressStart = 0;
      const HOLD_THRESHOLD = 500; // ms - hold this long to enter continuous mode
      let holdTimer = null;
      let enteredContinuousModeThisPress = false;

      function handlePressStart() {
        buttonPressStart = Date.now();
        enteredContinuousModeThisPress = false;

        // If in continuous mode, taps exit it
        if (continuousModeActive) {
          return;
        }

        // If speaking, tap interrupts and starts recording
        if (isSpeaking || speechQueue.length > 0) {
          stopSpeaking();
          startRecording();
          return;
        }

        // Start a timer - if held long enough, enter continuous mode
        holdTimer = setTimeout(() => {
          holdTimer = null;
          enteredContinuousModeThisPress = true;
          enterContinuousMode();
        }, HOLD_THRESHOLD);
      }

      function handlePressEnd() {
        const pressDuration = Date.now() - buttonPressStart;
        buttonPressStart = 0;

        // Clear hold timer if still pending
        if (holdTimer) {
          clearTimeout(holdTimer);
          holdTimer = null;
        }

        // If we just entered continuous mode on this press, don't do anything else
        if (enteredContinuousModeThisPress) {
          enteredContinuousModeThisPress = false;
          return;
        }

        // In continuous mode, tap exits it
        if (continuousModeActive) {
          exitContinuousMode();
          return;
        }

        // Short tap: toggle recording
        if (pressDuration < HOLD_THRESHOLD) {
          if (isListening) {
            stopRecording();
          } else {
            startRecording();
          }
        }
        // Long press already triggered continuous mode via timer
      }

      // Mouse events for desktop
      mainButton.addEventListener('mousedown', handlePressStart);
      mainButton.addEventListener('mouseup', handlePressEnd);

      mainButton.addEventListener('mouseleave', () => {
        // If user drags away while holding, cancel the hold timer
        if (holdTimer) {
          clearTimeout(holdTimer);
          holdTimer = null;
        }
      });

      // Touch events for mobile - distinguish swipes from taps
      let buttonTouchStartX = 0;
      let buttonTouchStartY = 0;
      let buttonTouchMoved = false;
      let buttonTouchStartTime = 0;
      let touchHoldTimer = null;
      let touchEnteredContinuousMode = false;

      mainButton.addEventListener('touchstart', (e) => {
        e.preventDefault(); // Prevent mouse events from also firing
        buttonTouchStartX = e.touches[0].clientX;
        buttonTouchStartY = e.touches[0].clientY;
        buttonTouchStartTime = Date.now();
        buttonTouchMoved = false;
        touchEnteredContinuousMode = false;

        // If in continuous mode, taps will exit it (handled in touchend)
        if (continuousModeActive) {
          return;
        }

        // If speaking, tap interrupts and starts recording
        if (isSpeaking || speechQueue.length > 0) {
          stopSpeaking();
          startRecording();
          return;
        }

        // Set timer to enter continuous mode after hold threshold
        touchHoldTimer = setTimeout(() => {
          if (!buttonTouchMoved) {
            touchHoldTimer = null;
            touchEnteredContinuousMode = true;
            enterContinuousMode();
          }
        }, HOLD_THRESHOLD);
      });

      mainButton.addEventListener('touchmove', (e) => {
        const deltaX = Math.abs(e.touches[0].clientX - buttonTouchStartX);
        const deltaY = Math.abs(e.touches[0].clientY - buttonTouchStartY);
        // If moved more than 20px, it's a swipe not a tap
        if (deltaX > 20 || deltaY > 20) {
          buttonTouchMoved = true;
          // Cancel the hold timer if it's a swipe
          if (touchHoldTimer) {
            clearTimeout(touchHoldTimer);
            touchHoldTimer = null;
          }
        }
      });

      mainButton.addEventListener('touchend', (e) => {
        e.preventDefault();
        const pressDuration = Date.now() - buttonTouchStartTime;

        // Clear the hold timer
        if (touchHoldTimer) {
          clearTimeout(touchHoldTimer);
          touchHoldTimer = null;
        }

        if (buttonTouchMoved) {
          // It was a swipe - don't do anything
          buttonTouchMoved = false;
          return;
        }

        // If we just entered continuous mode on this touch, don't do anything else
        if (touchEnteredContinuousMode) {
          touchEnteredContinuousMode = false;
          return;
        }

        // In continuous mode, tap exits it
        if (continuousModeActive) {
          exitContinuousMode();
          return;
        }

        // Short tap: toggle recording
        if (pressDuration < HOLD_THRESHOLD) {
          if (isListening) {
            stopRecording();
          } else {
            startRecording();
          }
        }
        // Long press already triggered continuous mode via timer
      });

      // Handle touch cancel (e.g., when iOS interrupts the touch)
      mainButton.addEventListener('touchcancel', () => {
        if (touchHoldTimer) {
          clearTimeout(touchHoldTimer);
          touchHoldTimer = null;
        }
        buttonTouchMoved = false;
        touchEnteredContinuousMode = false;
      });

      // Spacebar - tap to toggle recording, hold to enter continuous mode
      let spacebarPressStart = 0;
      let spacebarHoldTimer = null;
      let spacebarEnteredContinuousMode = false;

      document.addEventListener('keydown', (e) => {
        if (!voiceModal.classList.contains('hidden')) return;
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        if (!apiKey) return;
        if (e.repeat) return; // Ignore key repeat

        // Escape key exits continuous mode
        if (e.code === 'Escape' && continuousModeActive) {
          e.preventDefault();
          exitContinuousMode();
          return;
        }

        if (e.code === 'Space') {
          e.preventDefault();
          spacebarPressStart = Date.now();
          spacebarEnteredContinuousMode = false;

          // If in continuous mode, spacebar tap will exit it (handled in keyup)
          if (continuousModeActive) {
            return;
          }

          if (isSpeaking || speechQueue.length > 0) {
            stopSpeaking();
          }

          // Start a timer - if held long enough, enter continuous mode
          spacebarHoldTimer = setTimeout(() => {
            spacebarHoldTimer = null;
            spacebarEnteredContinuousMode = true;
            enterContinuousMode();
          }, HOLD_THRESHOLD);
        }
      });

      document.addEventListener('keyup', (e) => {
        if (e.code === 'Space' && spacebarPressStart > 0) {
          const pressDuration = Date.now() - spacebarPressStart;
          spacebarPressStart = 0;

          // Clear hold timer if still pending
          if (spacebarHoldTimer) {
            clearTimeout(spacebarHoldTimer);
            spacebarHoldTimer = null;
          }

          // If we just entered continuous mode on this press, don't do anything else
          if (spacebarEnteredContinuousMode) {
            spacebarEnteredContinuousMode = false;
            return;
          }

          // In continuous mode, tap exits it
          if (continuousModeActive) {
            exitContinuousMode();
            return;
          }

          // Short tap: toggle recording
          if (pressDuration < HOLD_THRESHOLD) {
            if (isListening) {
              stopRecording();
            } else {
              startRecording();
            }
          }
          // Long press already triggered continuous mode via timer
        }
      });

      // Settings dropdown menu
      settingsMenuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        settingsDropdown.classList.toggle('open');
      });

      // Close dropdown when clicking outside
      document.addEventListener('click', (e) => {
        if (!settingsDropdown.contains(e.target) && e.target !== settingsMenuBtn) {
          settingsDropdown.classList.remove('open');
        }
      });

      // Voice settings from dropdown
      voiceSettingsBtn.addEventListener('click', () => {
        settingsDropdown.classList.remove('open');
        openVoiceSettings();
      });

      // Cost settings from dropdown
      costSettingsBtn.addEventListener('click', openCostModal);

      // Copy chat
      copyChatBtn.addEventListener('click', copyChat);

      // Cost modal
      costModalClose.addEventListener('click', closeCostModal);
      costModal.addEventListener('click', (e) => {
        if (e.target === costModal) closeCostModal();
      });

      // About modal
      aboutBtn.addEventListener('click', () => {
        settingsDropdown.classList.remove('open');
        aboutModal.classList.remove('hidden');
      });
      aboutModalClose.addEventListener('click', () => {
        aboutModal.classList.add('hidden');
      });
      aboutModal.addEventListener('click', (e) => {
        if (e.target === aboutModal) aboutModal.classList.add('hidden');
      });

      // Privacy modal
      privacyBtn.addEventListener('click', () => {
        settingsDropdown.classList.remove('open');
        privacyModal.classList.remove('hidden');
      });
      privacyModalClose.addEventListener('click', () => {
        privacyModal.classList.add('hidden');
      });
      privacyModal.addEventListener('click', (e) => {
        if (e.target === privacyModal) privacyModal.classList.add('hidden');
      });

      // Debug modal
      if (debugBtn && debugModal) {
        debugBtn.addEventListener('click', () => {
          settingsDropdown.classList.remove('open');
          document.getElementById('debugLog').textContent = debugLogs.join('\n');
          debugModal.classList.remove('hidden');
        });
        debugModalClose.addEventListener('click', () => {
          debugModal.classList.add('hidden');
        });
        debugModal.addEventListener('click', (e) => {
          if (e.target === debugModal) debugModal.classList.add('hidden');
        });
        debugClearBtn.addEventListener('click', () => {
          debugLogs.length = 0;
          document.getElementById('debugLog').textContent = '';
        });
      } else {
        console.error('Debug elements not found:', { debugBtn, debugModal });
      }

      // Install app
      installBtn.addEventListener('click', handleInstallClick);
      installModalClose.addEventListener('click', () => {
        installModal.classList.add('hidden');
      });
      installModal.addEventListener('click', (e) => {
        if (e.target === installModal) installModal.classList.add('hidden');
      });

      // Stop button
      stopBtn.addEventListener('click', stopSpeaking);

      // Cancel button
      cancelBtn.addEventListener('click', cancelRecording);

      // Exit continuous mode button
      exitContinuousBtn.addEventListener('click', exitContinuousMode);

      // Voice modal
      modalClose.addEventListener('click', closeVoiceSettings);
      voiceModal.addEventListener('click', (e) => {
        if (e.target === voiceModal) closeVoiceSettings();
      });

      // Cloud voices toggle
      document.getElementById('cloudVoicesToggle').addEventListener('change', (e) => {
        cloudVoicesEnabled = e.target.checked;
        localStorage.setItem('cloudVoicesEnabled', cloudVoicesEnabled);
        // If turning off cloud voices and current selection is a cloud voice, clear it
        if (!cloudVoicesEnabled && selectedVoiceName) {
          const voices = speechSynthesis.getVoices();
          const currentVoice = voices.find(v => v.name === selectedVoiceName);
          if (currentVoice && isCloudVoice(currentVoice)) {
            selectedVoiceName = null;
            localStorage.removeItem('selectedVoice');
          }
        }
        populateVoiceList();
      });

      // Load voices and init default at startup
      if (speechSynthesis.onvoiceschanged !== undefined) {
        speechSynthesis.onvoiceschanged = () => {
          initDefaultVoice();
          // Update voice list if modal is open
          if (!voiceModal.classList.contains('hidden')) {
            populateVoiceList();
          }
        };
      }
      // Also try immediately in case voices are already loaded
      initDefaultVoice();

      // Mode switching - click anywhere in the toggle container to switch
      modeToggle.addEventListener('click', () => {
        console.log('Mode toggle clicked');
        setTextMode(!textMode);
      });
      // Debug: confirm event listener is attached
      console.log('Mode toggle listener attached', modeToggle);

      // Clear chat with inline confirmation
      let clearChatConfirming = false;
      const clearChatText = clearChatBtn.querySelector('.clear-chat-text');

      function resetClearConfirmation() {
        if (clearChatConfirming) {
          clearChatConfirming = false;
          clearChatBtn.classList.remove('confirming');
          clearChatText.textContent = 'Clear';
        }
      }

      clearChatBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (clearChatConfirming) {
          // Second click - actually clear
          startNewChat();
          resetClearConfirmation();
          clearChatBtn.classList.add('hidden');
        } else {
          // First click - show confirmation
          clearChatConfirming = true;
          clearChatBtn.classList.add('confirming');
          clearChatText.textContent = 'Clear?';
        }
      });

      // Click anywhere else to cancel clear confirmation
      document.addEventListener('click', (e) => {
        if (!clearChatBtn.contains(e.target)) {
          resetClearConfirmation();
        }
      });

      // Text input handling
      textInput.addEventListener('input', () => {
        // Auto-resize textarea
        textInput.style.height = 'auto';
        textInput.style.height = Math.min(textInput.scrollHeight, 160) + 'px';

        // Update send button state
        textSendBtn.classList.toggle('active', textInput.value.trim().length > 0);
      });

      textInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          submitTextMessage();
        }
      });

      textSendBtn.addEventListener('click', submitTextMessage);

      function submitTextMessage() {
        const text = textInput.value.trim();
        if (text && !isProcessingText) {
          textInput.value = '';
          textInput.style.height = 'auto';
          textSendBtn.classList.remove('active');
          textInput.blur(); // Hide keyboard on mobile
          sendTextToAPI(text);
        }
      }

      // Mobile keyboard handling - keep input above virtual keyboard
      if (window.visualViewport) {
        const baseBottom = 88; // 5.5rem in pixels

        function adjustForKeyboard() {
          const viewport = window.visualViewport;
          const keyboardHeight = window.innerHeight - viewport.height - viewport.offsetTop;

          if (keyboardHeight > 100) {
            // Keyboard is open
            textInputContainer.style.bottom = (keyboardHeight + 12) + 'px';
          } else {
            // Keyboard is closed
            textInputContainer.style.bottom = '';
          }
        }

        window.visualViewport.addEventListener('resize', adjustForKeyboard);
        window.visualViewport.addEventListener('scroll', adjustForKeyboard);
      }

      // Mobile swipe gestures for mode switching
      if (isMobile) {
        let touchStartX = 0;
        let touchStartY = 0;
        let touchStartTime = 0;
        let swipeTracking = false;

        function handleTouchStart(e) {
          // Don't interfere with input fields, modals, or settings
          if (e.target.closest('.text-input-container, .modal, .settings-dropdown')) return;

          touchStartX = e.touches[0].clientX;
          touchStartY = e.touches[0].clientY;
          touchStartTime = Date.now();
          swipeTracking = true;
        }

        function handleTouchEnd(e) {
          if (!swipeTracking) return;
          swipeTracking = false;

          // Don't interfere with input fields, modals, or settings
          if (e.target.closest('.text-input-container, .modal, .settings-dropdown')) return;

          const touchEndX = e.changedTouches[0].clientX;
          const touchEndY = e.changedTouches[0].clientY;
          const deltaX = touchEndX - touchStartX;
          const deltaY = touchEndY - touchStartY;
          const elapsed = Date.now() - touchStartTime;

          // Require: horizontal swipe > 80px, much more horizontal than vertical, completed in < 300ms
          const minSwipeDistance = 80;
          const maxSwipeTime = 300;

          if (Math.abs(deltaX) > minSwipeDistance &&
              Math.abs(deltaX) > Math.abs(deltaY) * 2 &&
              elapsed < maxSwipeTime) {
            if (deltaX < 0 && !textMode) {
              // Swipe left → text mode
              setTextMode(true);
            } else if (deltaX > 0 && textMode) {
              // Swipe right → voice mode
              setTextMode(false);
            }
          }
        }

        // Attach to both voiceScreen and conversationHistory (which is position:fixed overlay)
        voiceScreen.addEventListener('touchstart', handleTouchStart, { passive: true });
        voiceScreen.addEventListener('touchend', handleTouchEnd, { passive: true });
        conversationHistoryEl.addEventListener('touchstart', handleTouchStart, { passive: true });
        conversationHistoryEl.addEventListener('touchend', handleTouchEnd, { passive: true });
      }
      console.log('setupEventListeners END');
    }

    // ============ Start ============
    init();
