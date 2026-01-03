    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    }

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
    let speechProgressInterval = null;
    let textMode = localStorage.getItem('textMode') === 'true';
    let isProcessingText = false;
    const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    let currentStreamingElement = null;

    // Auto-mode (voice activity detection)
    let autoMode = localStorage.getItem('autoMode') === 'true';
    let autoModeAudioContext = null;
    let autoModeAnalyser = null;
    let autoModeStream = null;
    let autoModeMonitorInterval = null;
    let silenceTimer = null;
    let isAutoRecording = false;
    let hasSpeechStarted = false;
    let autoModeCooldown = false; // Prevents picking up TTS audio after speaking
    let interruptionsEnabledThisTurn = true; // Disabled per-turn if we detect audio bleed from speakers
    let bleedCheckDoneThisTurn = false; // Only check for bleed once per response turn
    const SILENCE_THRESHOLD = 0.7; // Audio level below which we consider silence (above typical background ~0.5)
    const SPEECH_THRESHOLD = 1.0; // Audio level above which we consider speech
    const INTERRUPT_THRESHOLD = 2.5; // Higher threshold for interrupting TTS (must speak louder)
    const SILENCE_TIMEOUT = 1000; // 1 second of silence before auto-submit
    const AUTO_MODE_COOLDOWN = 800; // Cooldown after TTS stops before listening again

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
    const uploadProgress = document.getElementById('uploadProgress');
    const uploadProgressBar = document.getElementById('uploadProgressBar');
    const aboutModal = document.getElementById('aboutModal');
    const aboutModalClose = document.getElementById('aboutModalClose');
    const aboutBtn = document.getElementById('aboutBtn');
    const privacyModal = document.getElementById('privacyModal');
    const privacyModalClose = document.getElementById('privacyModalClose');
    const privacyBtn = document.getElementById('privacyBtn');
    const errorToast = document.getElementById('errorToast');
    const textInputContainer = document.getElementById('textInputContainer');
    const textInput = document.getElementById('textInput');
    const textSendBtn = document.getElementById('textSendBtn');
    const modeToggle = document.getElementById('modeToggle');
    const voiceModeBtn = document.getElementById('voiceModeBtn');
    const textModeBtn = document.getElementById('textModeBtn');
    const conversationHistoryEl = document.getElementById('conversationHistory');
    const newChatBtn = document.getElementById('newChatBtn');

    // ============ Initialization ============
    function init() {
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
      updateNewChatButton();
      setupEventListeners();
      lockOrientation();
      checkPendingVoiceMessage();
      restoreAutoMode();
    }

    // ============ Auto Mode Restoration ============
    function restoreAutoMode() {
      // Only restore if we have an API key and auto mode was enabled
      if (apiKey && autoMode && !textMode) {
        // Small delay to let the UI settle
        setTimeout(() => {
          startAutoMode();
        }, 500);
      }
    }

    // ============ Pending Voice Message Recovery ============
    async function checkPendingVoiceMessage() {
      if (!apiKey) return;

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
        showError('Authentication failed');
        showLoginScreen();
      }
    }

    function logout() {
      apiKey = null;
      localStorage.removeItem('openrouter_api_key');
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
      mainButton.classList.remove('listening', 'processing', 'speaking', 'auto-listening');
      statusText.classList.remove('listening', 'speaking', 'auto-listening');

      switch (state) {
        case 'listening':
          mainButton.classList.add('listening');
          statusText.classList.add('listening');
          statusText.textContent = 'Listening';
          hintText.textContent = 'Push to send';
          hintText.classList.remove('hidden');
          cancelBtn.classList.remove('hidden');
          break;
        case 'auto-listening':
          mainButton.classList.add('auto-listening');
          statusText.classList.add('auto-listening');
          statusText.textContent = 'Auto mode';
          cancelBtn.classList.add('hidden');
          // Don't hide hint - it shows how to exit
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
        default:
          statusText.textContent = 'Ready';
          hintText.textContent = 'Double-tap for auto mode, or tap to speak';
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

    function showUploadProgress(visible) {
      if (visible) {
        uploadProgress.classList.add('visible');
        uploadProgress.classList.remove('speaking');
        uploadProgressBar.style.width = '0%';
      } else {
        uploadProgress.classList.remove('visible');
        uploadProgress.classList.remove('speaking');
      }
    }

    function setUploadProgress(percent) {
      uploadProgressBar.style.width = Math.min(100, percent) + '%';
    }

    function showSpeechProgress(visible) {
      if (visible) {
        uploadProgress.classList.add('visible', 'speaking');
        uploadProgressBar.style.width = '0%';
      } else {
        uploadProgress.classList.remove('visible', 'speaking');
        if (speechProgressInterval) {
          clearInterval(speechProgressInterval);
          speechProgressInterval = null;
        }
      }
    }

    function setSpeechProgress(percent) {
      uploadProgressBar.style.width = Math.min(100, percent) + '%';
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
      updateNewChatButton();
    }

    function updateNewChatButton() {
      if (conversationHistory.length > 0) {
        newChatBtn.classList.remove('hidden');
      } else {
        newChatBtn.classList.add('hidden');
      }
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

      // Disable auto mode when switching to text mode
      if (enabled && autoMode) {
        autoMode = false;
        localStorage.setItem('autoMode', 'false');
        stopAutoMode();
      }

      updateModeUI();
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

    // ============ Auto Mode (Voice Activity Detection) ============
    function toggleAutoMode() {
      // Don't allow auto mode in text mode
      if (textMode) {
        return;
      }

      autoMode = !autoMode;
      localStorage.setItem('autoMode', autoMode);

      if (autoMode) {
        startAutoMode();
      } else {
        stopAutoMode();
      }
    }

    async function startAutoMode() {
      try {
        // Stop any current speaking
        if (isSpeaking || speechQueue.length > 0) {
          stopSpeaking();
        }

        // Get microphone access
        const constraints = {
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        };

        autoModeStream = await navigator.mediaDevices.getUserMedia(constraints);

        // iOS Safari: unlock audio context on user gesture
        if (!window.audioUnlocked) {
          const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
          const buffer = audioCtx.createBuffer(1, 1, 22050);
          const source = audioCtx.createBufferSource();
          source.buffer = buffer;
          source.connect(audioCtx.destination);
          source.start(0);
          if (window.speechSynthesis) {
            const unlockUtterance = new SpeechSynthesisUtterance(' ');
            unlockUtterance.volume = 0.01;
            speechSynthesis.speak(unlockUtterance);
          }
          window.audioUnlocked = true;
        }

        // Set up audio analyser for VAD
        autoModeAudioContext = new (window.AudioContext || window.webkitAudioContext)();
        console.log('[Auto Mode] AudioContext created, state:', autoModeAudioContext.state, 'sampleRate:', autoModeAudioContext.sampleRate);

        // Resume AudioContext if suspended (required by browsers for user gesture)
        if (autoModeAudioContext.state === 'suspended') {
          await autoModeAudioContext.resume();
          console.log('[Auto Mode] AudioContext resumed, state:', autoModeAudioContext.state);
        }

        // Check stream tracks
        const tracks = autoModeStream.getAudioTracks();
        console.log('[Auto Mode] Audio tracks:', tracks.length, 'enabled:', tracks[0]?.enabled, 'muted:', tracks[0]?.muted);

        const source = autoModeAudioContext.createMediaStreamSource(autoModeStream);
        autoModeAnalyser = autoModeAudioContext.createAnalyser();
        autoModeAnalyser.fftSize = 2048; // Larger FFT for better resolution
        autoModeAnalyser.smoothingTimeConstant = 0.3;
        source.connect(autoModeAnalyser);
        console.log('[Auto Mode] Analyser connected, fftSize:', autoModeAnalyser.fftSize);

        // Start monitoring for speech
        hasSpeechStarted = false;
        isAutoRecording = false;
        startVoiceActivityMonitoring();

        setButtonState('auto-listening');
        hintText.textContent = 'Tap to exit auto mode';
        hintText.classList.remove('hidden');

      } catch (error) {
        console.error('Auto mode error:', error);
        showError('Could not start auto mode');
        autoMode = false;
        localStorage.setItem('autoMode', 'false');
        setButtonState('ready');
      }
    }

    function stopAutoMode() {
      // Stop monitoring
      if (autoModeMonitorInterval) {
        clearInterval(autoModeMonitorInterval);
        autoModeMonitorInterval = null;
      }

      // Clear silence timer
      if (silenceTimer) {
        clearTimeout(silenceTimer);
        silenceTimer = null;
      }

      // Stop any active recording
      if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        // We need to prevent the normal onstop handler from restarting auto mode
        isAutoRecording = false;
        mediaRecorder.stop();
      }

      // Clean up audio context
      if (autoModeAudioContext) {
        autoModeAudioContext.close();
        autoModeAudioContext = null;
        autoModeAnalyser = null;
      }

      // Clean up stream
      if (autoModeStream) {
        autoModeStream.getTracks().forEach(track => track.stop());
        autoModeStream = null;
      }

      hasSpeechStarted = false;
      isAutoRecording = false;
      isListening = false;

      // Reset hint text
      hintText.textContent = 'Double-tap for auto mode, or tap to speak';

      setButtonState('ready');
    }

    function getAudioLevel() {
      if (!autoModeAnalyser) return 0;

      // Use time-domain data for more reliable voice detection
      const dataArray = new Uint8Array(autoModeAnalyser.fftSize);
      autoModeAnalyser.getByteTimeDomainData(dataArray);

      // Calculate RMS (root mean square) for audio level
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        const sample = (dataArray[i] - 128) / 128; // Normalize to -1 to 1
        sum += sample * sample;
      }
      const rms = Math.sqrt(sum / dataArray.length);

      // Scale to 0-100 range for easier threshold comparison
      return rms * 100;
    }

    function startVoiceActivityMonitoring() {
      console.log('[Auto Mode] Starting voice activity monitoring');
      let logCounter = 0;

      autoModeMonitorInterval = setInterval(() => {
        if (!autoMode) return;

        const level = getAudioLevel();

        // Log level periodically for debugging
        logCounter++;
        if (logCounter % 10 === 0) { // Every 1 second
          console.log('[Auto Mode] Audio level:', level.toFixed(2), 'threshold:', SPEECH_THRESHOLD, 'recording:', isAutoRecording, 'cooldown:', autoModeCooldown);
        }

        // Update visual audio level indicator
        updateAutoModeVisual(level);

        // Don't start new recordings while speaking, processing, in cooldown, etc.
        const isAssistantBusy = isSpeaking || speechQueue.length > 0;
        const isProcessing = mainButton.classList.contains('processing');

        // Check for interruption - user must speak LOUDER to interrupt (higher threshold)
        // Only enabled if no audio bleed detected this turn (e.g., using headphones)
        if (isAssistantBusy && interruptionsEnabledThisTurn && level > INTERRUPT_THRESHOLD) {
          console.log('[Auto Mode] *** INTERRUPTION *** level:', level);
          stopSpeaking();
          // Start cooldown then record
          autoModeCooldown = true;
          setTimeout(() => {
            autoModeCooldown = false;
            if (autoMode && !isAutoRecording && !isSpeaking) {
              startAutoRecording();
            }
          }, 300);
          return;
        }

        // Skip normal monitoring while assistant is speaking (prevents TTS pickup)
        if (isAssistantBusy) {
          return;
        }

        if (!isAutoRecording && !isProcessing && !autoModeCooldown) {
          // Not currently recording - look for speech to start
          if (level > SPEECH_THRESHOLD) {
            console.log('[Auto Mode] Speech detected, level:', level);
            // Normal case - start recording
            startAutoRecording();
          }
        } else if (isAutoRecording) {
          // Currently recording - look for silence to stop
          if (level > SILENCE_THRESHOLD) {
            // Still speaking - reset silence timer
            hasSpeechStarted = true;
            if (silenceTimer) {
              clearTimeout(silenceTimer);
              silenceTimer = null;
            }
          } else if (hasSpeechStarted && !silenceTimer) {
            // Silence detected after speech - start silence timer
            console.log('[Auto Mode] Silence detected, starting timer');
            silenceTimer = setTimeout(() => {
              if (isAutoRecording && autoMode) {
                console.log('[Auto Mode] Silence timeout, stopping recording');
                stopAutoRecording();
              }
            }, SILENCE_TIMEOUT);
          }
        }

      }, 100); // Check every 100ms
    }

    function updateAutoModeVisual(level) {
      // Show audio level in the status text when in auto-listening state
      if (mainButton.classList.contains('auto-listening')) {
        const normalizedLevel = Math.min(100, Math.round(level * 2));
        if (level > SPEECH_THRESHOLD) {
          statusText.textContent = 'Hearing you...';
        } else if (level > SILENCE_THRESHOLD) {
          statusText.textContent = 'Auto mode';
        } else {
          statusText.textContent = 'Auto mode';
        }
      }
    }

    async function startAutoRecording() {
      if (isAutoRecording || isListening) return;

      console.log('[Auto Mode] Starting recording');
      isAutoRecording = true;
      hasSpeechStarted = true;
      audioChunks = [];

      // Determine MIME type
      let mimeType = 'audio/webm';
      if (MediaRecorder.isTypeSupported('audio/mp4')) {
        mimeType = 'audio/mp4';
      } else if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        mimeType = 'audio/webm;codecs=opus';
      }

      // Create MediaRecorder using the existing auto mode stream
      mediaRecorder = new MediaRecorder(autoModeStream, { mimeType });

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunks.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        console.log('[Auto Mode] Recording stopped, processing...');
        isAutoRecording = false;
        isListening = false;
        hasSpeechStarted = false;

        if (silenceTimer) {
          clearTimeout(silenceTimer);
          silenceTimer = null;
        }

        // Don't process if auto mode was disabled
        if (!autoMode) {
          console.log('[Auto Mode] Auto mode disabled, skipping processing');
          return;
        }

        const audioBlob = new Blob(audioChunks, { type: mimeType });
        console.log('[Auto Mode] Audio blob size:', audioBlob.size);

        // Check if we have meaningful audio (more than a tiny snippet)
        if (audioBlob.size < 1000) {
          // Too small, probably just noise - restart listening
          console.log('[Auto Mode] Audio too small, discarding');
          setButtonState('auto-listening');
          return;
        }

        setButtonState('processing');
        statusText.textContent = 'Thinking';

        try {
          const wavBlob = await convertToWav(audioBlob);
          const base64Audio = await blobToBase64(wavBlob);
          console.log('[Auto Mode] Sending to API...');
          savePendingVoiceMessage(base64Audio);
          await sendAudioToAPI(base64Audio);
          console.log('[Auto Mode] API response received');
          clearPendingVoiceMessage();
        } catch (e) {
          console.error('[Auto Mode] Audio processing error:', e);
          showError('Failed to process audio');
        }

        // After processing, if still in auto mode, go back to listening
        // (This may not run if TTS started - the TTS end handler will reset state)
        if (autoMode && !isSpeaking && speechQueue.length === 0) {
          console.log('[Auto Mode] Returning to listening state');
          setButtonState('auto-listening');
        }
      };

      mediaRecorder.start();
      isListening = true;
      setButtonState('listening');
    }

    function stopAutoRecording() {
      if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
      }
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
      // Build request body with :online model
      const requestBody = JSON.stringify({
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
      });

      const response = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `${OPENROUTER_API_URL}/chat/completions`);
        xhr.setRequestHeader('Authorization', `Bearer ${apiKey}`);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.setRequestHeader('HTTP-Referer', window.location.origin);
        xhr.setRequestHeader('X-Title', 'Spraff');

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(xhr.responseText);
          } else {
            try {
              const error = JSON.parse(xhr.responseText);
              reject(new Error(error.error?.message || 'API request failed'));
            } catch {
              reject(new Error('API request failed'));
            }
          }
        };

        xhr.onerror = () => reject(new Error('Network error'));
        xhr.send(requestBody);
      });

      // Parse the SSE response
      const lines = response.split('\n');
      let fullResponse = '';
      let usage = null;

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
      const requestStartTime = performance.now();
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

      // Show uploading status for large payloads (>100KB)
      const isLargeUpload = payloadSize > 100 * 1024;
      const payloadSizeKB = Math.round(payloadSize / 1024);
      if (isLargeUpload) {
        statusText.textContent = `Uploading ${payloadSizeKB} KB`;
        showUploadProgress(true);
      }

      try {
        // Use XHR for upload progress tracking, then process streaming response
        const response = await new Promise((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open('POST', `${OPENROUTER_API_URL}/chat/completions`);
          xhr.setRequestHeader('Authorization', `Bearer ${apiKey}`);
          xhr.setRequestHeader('Content-Type', 'application/json');
          xhr.setRequestHeader('HTTP-Referer', window.location.origin);
          xhr.setRequestHeader('X-Title', 'Spraff');

          // Track real upload progress
          if (isLargeUpload) {
            xhr.upload.onprogress = (e) => {
              if (e.lengthComputable) {
                const percent = (e.loaded / e.total) * 100;
                setUploadProgress(percent);
              }
            };

            xhr.upload.onload = () => {
              setUploadProgress(100);
              statusText.textContent = 'Thinking';
              setTimeout(() => showUploadProgress(false), 300);
            };
          }

          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve(xhr.responseText);
            } else {
              try {
                const error = JSON.parse(xhr.responseText);
                reject(new Error(error.error?.message || 'API request failed'));
              } catch {
                reject(new Error('API request failed'));
              }
            }
          };

          xhr.onerror = () => reject(new Error('Network error'));
          xhr.send(requestBody);
        });

        showUploadProgress(false);

        // Parse the SSE response (XHR doesn't stream, so we process all at once)
        const lines = response.split('\n');
        let fullResponse = '';
        let usage = null;
        let userTranscript = null;
        let transcriptExtracted = false;

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
            updateNewChatButton();
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
          updateNewChatButton();
        }

      } catch (error) {
        showUploadProgress(false);
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
            updateNewChatButton();
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
          updateNewChatButton();
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
        bleedCheckDoneThisTurn = false; // Reset bleed check for new response
      }
      speechTotalChars += sanitized.length;

      speechQueue.push(sanitized);
      if (!isSpeaking) processQueue();
    }

    function processQueue() {
      if (shouldStopSpeaking || speechQueue.length === 0) {
        isSpeaking = false;
        if (speechQueue.length === 0) {
          showSpeechProgress(false);
          stopBtn.classList.add('hidden');

          // If in auto mode, add cooldown before listening again
          if (autoMode) {
            autoModeCooldown = true;
            setTimeout(() => {
              autoModeCooldown = false;
              if (autoMode) {
                setButtonState('auto-listening');
              }
            }, AUTO_MODE_COOLDOWN);
          } else {
            setButtonState('ready');
          }
        }
        return;
      }

      isSpeaking = true;
      const text = speechQueue.shift();
      const textLength = text.length;

      // Show speech progress bar
      if (speechTotalChars > 0) {
        showSpeechProgress(true);
        setSpeechProgress((speechSpokenChars / speechTotalChars) * 100);
      }

      if (!window.speechSynthesis) {
        speechSpokenChars += textLength;
        processQueue();
        return;
      }

      // iOS Safari workaround: cancel any pending speech first
      speechSynthesis.cancel();

      // Auto-mode: capture baseline audio level before TTS starts
      // We'll check for audio bleed once speech begins
      let preStartLevel = 0;
      if (autoMode && autoModeAnalyser) {
        preStartLevel = getAudioLevel();
      }

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
        if (speechProgressInterval) {
          clearInterval(speechProgressInterval);
          speechProgressInterval = null;
        }
        speechSpokenChars += textLength;
        processQueue();
      };

      utterance.onstart = () => {
        console.log('[TTS] Utterance started');
        // Auto-mode: detect audio bleed from speakers into mic (only once per response)
        if (autoMode && autoModeAnalyser && !bleedCheckDoneThisTurn) {
          bleedCheckDoneThisTurn = true;
          // Start with interruptions DISABLED - only enable if no bleed detected
          interruptionsEnabledThisTurn = false;

          // Sample audio levels over 500ms to detect bleed reliably
          let maxLevel = 0;
          let sampleCount = 0;
          const bleedCheckInterval = setInterval(() => {
            if (!isSpeaking) {
              clearInterval(bleedCheckInterval);
              return;
            }
            const level = getAudioLevel();
            if (level > maxLevel) maxLevel = level;
            sampleCount++;

            // After 500ms (5 samples at 100ms), make the decision
            if (sampleCount >= 5) {
              clearInterval(bleedCheckInterval);
              const levelIncrease = maxLevel - preStartLevel;
              console.log('[Auto Mode] Audio bleed check - before:', preStartLevel.toFixed(2),
                          'maxDuring:', maxLevel.toFixed(2), 'increase:', levelIncrease.toFixed(2));

              // Only enable interruptions if NO significant audio bleed detected
              if (levelIncrease <= 0.5) {
                console.log('[Auto Mode] No audio bleed detected - interruptions enabled for this turn.');
                interruptionsEnabledThisTurn = true;
              } else {
                console.log('[Auto Mode] Audio bleed detected! Interruptions disabled for this turn.');
              }
            }
          }, 100);
        }
      };

      utterance.onend = markEnded;
      utterance.onerror = markEnded;

      // Animate progress during speech using estimated timing
      const estimatedDuration = Math.max(2000, text.length * 80);
      const startChars = speechSpokenChars;
      const speechStartTime = performance.now();
      speechProgressInterval = setInterval(() => {
        if (speechTotalChars > 0) {
          const elapsed = performance.now() - speechStartTime;
          const charsSpoken = Math.min(textLength, (elapsed / estimatedDuration) * textLength);
          const totalProgress = ((startChars + charsSpoken) / speechTotalChars) * 100;
          setSpeechProgress(totalProgress);
        }
      }, 50);

      // Fallback timeout for iOS
      setTimeout(() => {
        if (!ended && isSpeaking) {
          console.warn('Speech timeout fallback triggered');
          markEnded();
        }
      }, estimatedDuration);

      // iOS Safari: need to resume in case it's paused
      speechSynthesis.resume();
      speechSynthesis.speak(utterance);
    }

    function stopSpeaking() {
      shouldStopSpeaking = true;
      speechQueue = [];
      speechSynthesis.cancel();
      isSpeaking = false;
      showSpeechProgress(false);

      // If in auto mode, add cooldown to prevent picking up residual audio
      if (autoMode) {
        autoModeCooldown = true;
        setTimeout(() => {
          autoModeCooldown = false;
          if (autoMode) {
            setButtonState('auto-listening');
          }
        }, AUTO_MODE_COOLDOWN);
      } else {
        setButtonState('ready');
      }

      stopBtn.classList.add('hidden');
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
      loginBtn.addEventListener('click', startOAuthFlow);
      logoutBtn.addEventListener('click', () => {
        settingsDropdown.classList.remove('open');
        logout();
      });

      // Main button click (with double-click detection for auto-mode)
      let clickTimer = null;
      let clickCount = 0;

      mainButton.addEventListener('click', () => {
        clickCount++;

        if (clickCount === 1) {
          // Wait to see if this is a double-click
          clickTimer = setTimeout(() => {
            clickCount = 0;
            // Single click - normal behavior
            handleMainButtonClick();
          }, 250);
        } else if (clickCount === 2) {
          // Double click - toggle auto mode
          clearTimeout(clickTimer);
          clickCount = 0;
          toggleAutoMode();
        }
      });

      function handleMainButtonClick() {
        // In auto mode, single click stops auto mode
        if (autoMode) {
          toggleAutoMode();
          return;
        }

        if (isSpeaking || speechQueue.length > 0) {
          stopSpeaking();
        }
        if (isListening) {
          stopRecording();
        } else {
          startRecording();
        }
      }

      // Spacebar
      document.addEventListener('keydown', (e) => {
        if (!voiceModal.classList.contains('hidden')) return;
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        if (!apiKey) return;

        if (e.code === 'Space') {
          e.preventDefault();
          if (isSpeaking || speechQueue.length > 0) {
            stopSpeaking();
          }
          if (isListening) {
            stopRecording();
          } else {
            startRecording();
          }
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

      // Stop button
      stopBtn.addEventListener('click', stopSpeaking);

      // Cancel button
      cancelBtn.addEventListener('click', cancelRecording);

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
      modeToggle.addEventListener('click', () => setTextMode(!textMode));

      // New chat
      newChatBtn.addEventListener('click', startNewChat);

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

    }

    // ============ Start ============
    init();
