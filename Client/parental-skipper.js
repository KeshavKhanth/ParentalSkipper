(function () {
    'use strict';

    // DEBUG: Visual indicator that script is loaded
    const debugOverlay = document.createElement('div');
    debugOverlay.style.cssText = 'position:fixed;top:0;left:0;background:purple;color:white;z-index:999999;padding:5px;font-size:12px;pointer-events:none;opacity:0.8;';
    debugOverlay.textContent = 'Parental Skipper v2.0 Loaded';
    document.body.appendChild(debugOverlay);
    setTimeout(() => debugOverlay.remove(), 5000);

    console.log('%c[Parental Skipper] Script loaded and initialized (v2.0).', 'color: #8b5cf6; font-size: 14px; font-weight: bold;');

    // State
    let currentSegments = [];
    let currentItemId = null;
    let isSkipping = false;
    let isEnabled = localStorage.getItem('parentalSkipperEnabled') !== 'false'; // Default ON
    let toggleButton = null;
    let skipNotification = null;
    let videoElement = null;
    let lastDetectedItemId = null;

    // --- Network Interception for Item ID Detection ---
    const originalFetch = window.fetch;
    window.fetch = function (...args) {
        const url = args[0]?.url || args[0];
        if (typeof url === 'string') {
            extractItemIdFromUrlString(url, 'Fetch');
        }
        return originalFetch.apply(this, args);
    };

    const originalXHROpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (method, url, ...rest) {
        if (typeof url === 'string') {
            extractItemIdFromUrlString(url, 'XHR');
        }
        return originalXHROpen.apply(this, [method, url, ...rest]);
    };

    function extractItemIdFromUrlString(url, source) {
        // Look for item ID in URL patterns
        // Common patterns: /Items/{id}, /PlaybackInfo?ItemId={id}, etc.
        const itemMatch = url.match(/\/Items\/([a-f0-9-]{32})/i) ||
                          url.match(/[?&](?:ItemId|id)=([a-f0-9-]{32})/i);

        if (itemMatch && itemMatch[1]) {
            // Filter out user IDs if possible (usually standard Item IDs are UUIDs, User IDs are too, but context matters)
            // We'll assume if it looks like a UUID, it might be an item.
            // But we ignore /Users/{userId} which is handled separately usually.
            if (!url.includes('/Users/') || url.includes('/Items/')) {
                if (lastDetectedItemId !== itemMatch[1]) {
                    lastDetectedItemId = itemMatch[1];
                    console.log(`[Parental Skipper] 🔍 Detected item ID from ${source}: ${lastDetectedItemId}`);
                }
            }
        }
    }

    // --- API & Auth ---
    function getAuthHeader() {
        const apiClient = window.ApiClient;
        if (!apiClient) return null;

        return 'MediaBrowser Client="Jellyfin Web", Device="Browser", DeviceId="' +
            (apiClient.deviceId ? apiClient.deviceId() : 'unknown') +
            '", Version="' + (apiClient.appVersion ? apiClient.appVersion() : '10.8.0') +
            '", Token="' + (apiClient.accessToken ? apiClient.accessToken() : '') + '"';
    }

    function fetchSegments(itemId) {
        if (!itemId) return;

        console.log(`%c[Parental Skipper] Fetching segments for item: ${itemId}`, 'color: #0ea5e9; font-weight: bold;');

        const apiClient = window.ApiClient;
        const baseUrl = apiClient?.serverAddress ? apiClient.serverAddress() : '';
        const url = baseUrl + '/ParentalSkipper/Segments/' + itemId;

        const headers = {};
        const authHeader = getAuthHeader();
        if (authHeader) headers['X-Emby-Authorization'] = authHeader;

        fetch(url, { headers: headers })
            .then(r => {
                if (!r.ok) throw new Error(r.status);
                return r.json();
            })
            .then(segments => {
                currentSegments = segments || [];
                console.log(`[Parental Skipper] ✅ Loaded ${currentSegments.length} segments for ${itemId}`);
                updateToggleButtonBadge();

                // If we have segments, run a check immediately in case we are already in one
                if (currentSegments.length > 0 && videoElement) {
                    checkForSkip();
                }
            })
            .catch(err => {
                console.error('[Parental Skipper] Error fetching segments:', err);
            });
    }

    // --- UI Elements ---
    function showSkipNotification(segment) {
        const existing = document.getElementById('parental-skipper-notification');
        if (existing) existing.remove();

        skipNotification = document.createElement('div');
        skipNotification.id = 'parental-skipper-notification';
        skipNotification.style.cssText = `
            position: fixed; top: 10%; left: 50%; transform: translateX(-50%);
            background: rgba(220, 38, 38, 0.9); color: white; padding: 12px 24px;
            border-radius: 8px; font-size: 16px; font-weight: bold; z-index: 999999;
            box-shadow: 0 4px 12px rgba(0,0,0,0.5); pointer-events: none;
            font-family: sans-serif; transition: opacity 0.5s;
        `;

        const reason = segment.Reason || 'Restricted Content';
        skipNotification.innerHTML = `⏩ Skipping: ${reason}`;
        document.body.appendChild(skipNotification);

        setTimeout(() => {
            if (skipNotification && skipNotification.parentNode) {
                skipNotification.style.opacity = '0';
                setTimeout(() => skipNotification.remove(), 500);
            }
        }, 3000);
    }

    function createToggleButton() {
        if (document.getElementById('parental-skipper-toggle')) return;

        toggleButton = document.createElement('button');
        toggleButton.id = 'parental-skipper-toggle';
        toggleButton.style.cssText = `
            position: fixed; bottom: 80px; right: 20px;
            background: ${isEnabled ? '#22c55e' : '#6b7280'};
            color: white; border: none; padding: 10px 16px;
            border-radius: 8px; font-size: 14px; font-weight: bold;
            cursor: pointer; z-index: 999998; box-shadow: 0 2px 10px rgba(0,0,0,0.3);
            font-family: sans-serif; transition: background 0.2s, transform 0.1s;
        `;

        updateToggleButtonBadge();

        toggleButton.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            isEnabled = !isEnabled;
            localStorage.setItem('parentalSkipperEnabled', isEnabled);
            toggleButton.style.background = isEnabled ? '#22c55e' : '#6b7280';
            updateToggleButtonBadge();
            console.log(`[Parental Skipper] Toggled: ${isEnabled ? 'ON' : 'OFF'}`);
        };

        document.body.appendChild(toggleButton);
    }

    function updateToggleButtonBadge() {
        if (!toggleButton) return;
        const count = currentSegments.length;
        toggleButton.innerHTML = isEnabled
            ? `🛡️ ON${count > 0 ? ` <span style="font-size:0.9em;opacity:0.9">(${count})</span>` : ''}`
            : '🛡️ OFF';
    }

    // --- Core Logic ---
    function performSkip(segment) {
        if (isSkipping || !videoElement) return;

        isSkipping = true;
        const end = segment.End !== undefined ? segment.End : segment.end;

        console.log(`[Parental Skipper] 🚫 SKIPPING: ${videoElement.currentTime.toFixed(1)}s -> ${end}s`);
        showSkipNotification(segment);

        // Seek
        videoElement.currentTime = end + 0.5; // +0.5s buffer

        // Cooldown
        setTimeout(() => {
            isSkipping = false;
        }, 1500);
    }

    function checkForSkip() {
        if (!isEnabled || isSkipping || !videoElement || currentSegments.length === 0) return;

        const currentTime = videoElement.currentTime;

        for (const segment of currentSegments) {
            const start = segment.Start !== undefined ? segment.Start : segment.start;
            const end = segment.End !== undefined ? segment.End : segment.end;

            // Check if inside segment
            if (currentTime >= start && currentTime < end) {
                performSkip(segment);
                return;
            }
        }
    }

    // --- Item Detection ---
    function tryDetectItem() {
        // Priority 1: Window.playbackManager (Jellyfin 10.9+)
        if (window.playbackManager?.currentItem) {
            const item = window.playbackManager.currentItem();
            if (item && item.Id) return item.Id;
        }

        // Priority 2: ApiClient._playbackManager
        if (window.ApiClient?._playbackManager?.currentItem) {
            const item = window.ApiClient._playbackManager.currentItem();
            if (item && item.Id) return item.Id;
        }

        // Priority 3: URL params (id=...)
        const urlParams = new URLSearchParams(window.location.hash.split('?')[1]);
        if (urlParams.has('id')) return urlParams.get('id');
        if (urlParams.has('videoId')) return urlParams.get('videoId');

        // Priority 4: Network interception cache
        if (lastDetectedItemId) return lastDetectedItemId;

        return null;
    }

    function onVideoStateChange() {
        const newItemId = tryDetectItem();

        if (newItemId && newItemId !== currentItemId) {
            console.log(`[Parental Skipper] 🆕 New Item Detected: ${newItemId} (Old: ${currentItemId})`);
            currentItemId = newItemId;
            currentSegments = []; // Clear old segments
            fetchSegments(newItemId);
        } else if (!newItemId && currentItemId) {
            // Keep currentItemId if we can't find a new one, but warn
            // console.warn('[Parental Skipper] Could not detect item ID, keeping previous:', currentItemId);
        }
    }

    // --- Video Element Management ---
    function attachToVideo(video) {
        if (videoElement === video) return;

        if (videoElement) {
            // Clean up old listeners
            videoElement.removeEventListener('timeupdate', checkForSkip);
            videoElement.removeEventListener('play', onVideoStateChange);
            videoElement.removeEventListener('loadeddata', onVideoStateChange);
        }

        videoElement = video;
        console.log('[Parental Skipper] 🎥 Video Element Attached');

        // Listeners
        // timeupdate fires ~4 times per second during playback
        video.addEventListener('timeupdate', checkForSkip);

        // Check for item change on play/load
        video.addEventListener('play', onVideoStateChange);
        video.addEventListener('loadeddata', onVideoStateChange);

        // Initial check
        onVideoStateChange();
        createToggleButton();
    }

    // --- Mutation Observer ---
    // This is the robust way to handle SPA navigation and dynamic player creation
    const observer = new MutationObserver((mutations) => {
        let videoFound = false;

        // Check if video was added
        for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
                if (node.nodeName === 'VIDEO') {
                    attachToVideo(node);
                    videoFound = true;
                } else if (node.querySelectorAll) {
                    const v = node.querySelector('video');
                    if (v) {
                        attachToVideo(v);
                        videoFound = true;
                    }
                }
            }
        }

        // Fallback: If no video added, check if one exists in DOM that we missed
        if (!videoFound && !document.body.contains(videoElement)) {
            const v = document.querySelector('video');
            if (v) attachToVideo(v);
        }
    });

    // Start Observing
    observer.observe(document.body, { childList: true, subtree: true });

    // Initial Scan
    const initialVideo = document.querySelector('video');
    if (initialVideo) attachToVideo(initialVideo);

    // Global URL change detection (SPA)
    let lastUrl = window.location.href;
    setInterval(() => {
        if (window.location.href !== lastUrl) {
            lastUrl = window.location.href;
            console.log('[Parental Skipper] 🧭 URL Changed');
            // Give a small delay for DOM to update, then force check
            setTimeout(() => {
                const v = document.querySelector('video');
                if (v) attachToVideo(v); // Re-attach or re-verify
                onVideoStateChange(); // Re-check item ID
            }, 500);
        }
    }, 1000);

})();
