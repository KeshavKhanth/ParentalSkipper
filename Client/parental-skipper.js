(function () {
    'use strict';

    // DEBUG: Visual indicator that script is loaded
    function createDebugOverlay() {
        if (!document.body) {
            setTimeout(createDebugOverlay, 100);
            return;
        }
        const debugOverlay = document.createElement('div');
        debugOverlay.style.cssText = 'position:fixed;top:0;left:0;background:purple;color:white;z-index:999999;padding:5px;font-size:12px;pointer-events:none;opacity:0.8;';
        debugOverlay.textContent = 'Parental Skipper v2.1 Loaded';
        document.body.appendChild(debugOverlay);
        setTimeout(() => debugOverlay.remove(), 5000);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', createDebugOverlay);
    } else {
        createDebugOverlay();
    }

    console.log('%c[Parental Skipper] Script loaded and initialized (v2.1).', 'color: #8b5cf6; font-size: 14px; font-weight: bold;');

    // State
    let currentSegments = [];
    let currentItemId = null;
    let isSkipping = false;
    let isEnabled = localStorage.getItem('parentalSkipperEnabled') !== 'false'; // Default ON
    let toggleButton = null;
    let skipNotification = null;
    let notificationTimeout = null; // For clearing pending removals
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
        // GUIDs are usually 32 hex chars (sometimes with dashes). Jellyfin uses 32 hex chars.
        // But the comment suggests allowing standard UUID format (36 chars) as well.
        // Matches:
        // 1. /Items/xxxxxxxx...
        // 2. id=xxxxxxxx... or ItemId=xxxxxxxx...

        // Regex for 32 hex chars OR 36 chars (standard UUID with dashes)
        const uuidPattern = '([a-f0-9]{32}|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})';
        const urlRegex = new RegExp(`\\/Items\\/${uuidPattern}`, 'i');
        const paramRegex = new RegExp(`[?&](?:ItemId|id)=${uuidPattern}`, 'i');

        const itemMatch = url.match(urlRegex) || url.match(paramRegex);

        if (itemMatch && itemMatch[1]) {
            // Filter out user IDs if possible
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
        if (!apiClient || typeof apiClient.serverAddress !== 'function') {
             console.warn('[Parental Skipper] ApiClient not ready or serverAddress missing.');
             return;
        }

        const baseUrl = apiClient.serverAddress();
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
        // Clear pending removal
        if (notificationTimeout) {
            clearTimeout(notificationTimeout);
            notificationTimeout = null;
        }

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
        if (document.body) {
            document.body.appendChild(skipNotification);
        }

        // Set new removal timeout
        notificationTimeout = setTimeout(() => {
            if (skipNotification && skipNotification.parentNode) {
                skipNotification.style.opacity = '0';
                setTimeout(() => {
                    if (skipNotification) skipNotification.remove();
                    skipNotification = null;
                }, 500);
            }
            notificationTimeout = null;
        }, 3000);
    }

    function createToggleButton() {
        if (!document.body) return; // Wait for body
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

        // Seek with buffer to ensure we don't land in the segment again
        const targetTime = end + 0.5;
        videoElement.currentTime = targetTime;

        // Extended cooldown with verification - ensure we don't double skip
        // Use a longer timeout to handle slow seeks or buffering
        setTimeout(() => {
            if (!videoElement) {
                isSkipping = false;
                return;
            }

            // Verify we are past the segment, if not push forward again
            const currentTime = videoElement.currentTime;
            if (currentTime < end) {
                console.log(`[Parental Skipper] ⚠️ Seek verification: Still at ${currentTime.toFixed(1)}s, adjusting to ${targetTime}s`);
                videoElement.currentTime = targetTime;

                // Add additional verification after adjustment
                setTimeout(() => {
                    isSkipping = false;
                }, 500);
            } else {
                isSkipping = false;
            }
        }, 1500);
    }

    function checkForSkip() {
        if (!isEnabled || isSkipping || !videoElement || currentSegments.length === 0) return;

        const currentTime = videoElement.currentTime;

        // Guard against NaN or invalid time values
        if (!isFinite(currentTime) || currentTime < 0) {
            return;
        }

        for (const segment of currentSegments) {
            const start = segment.Start !== undefined ? segment.Start : segment.start;
            const end = segment.End !== undefined ? segment.End : segment.end;

            // Validate segment data
            if (!isFinite(start) || !isFinite(end) || start < 0 || end < 0 || start >= end) {
                console.warn(`[Parental Skipper] Invalid segment data: start=${start}, end=${end}`);
                continue;
            }

            // Check if inside segment - use a small tolerance to avoid edge cases
            const tolerance = 0.1;
            if (currentTime >= (start - tolerance) && currentTime < end) {
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

        // Priority 3: URL params
        // Check both hash params (typical in Jellyfin SPA) and search params (direct links)
        let id = null;

        // Check Hash Params (e.g. #/video?id=...)
        if (window.location.hash && window.location.hash.includes('?')) {
            const hashParams = new URLSearchParams(window.location.hash.split('?')[1]);
            if (hashParams.has('id')) id = hashParams.get('id');
            else if (hashParams.has('videoId')) id = hashParams.get('videoId');
            else if (hashParams.has('itemId')) id = hashParams.get('itemId');
        }

        if (!id) {
             // Check Query Params (e.g. ?id=...)
             const searchParams = new URLSearchParams(window.location.search);
             if (searchParams.has('id')) id = searchParams.get('id');
             else if (searchParams.has('videoId')) id = searchParams.get('videoId');
             else if (searchParams.has('itemId')) id = searchParams.get('itemId');
        }

        if (id) return id;

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
            // Keep currentItemId if we can't find a new one
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
        video.addEventListener('timeupdate', checkForSkip);
        video.addEventListener('play', onVideoStateChange);
        video.addEventListener('loadeddata', onVideoStateChange);

        // Initial check
        onVideoStateChange();
        createToggleButton();
    }

    // --- Mutation Observer ---
    function initObserver() {
        if (!document.body) {
            setTimeout(initObserver, 100);
            return;
        }

        const observer = new MutationObserver((mutations) => {
            let videoFound = false;

            for (const mutation of mutations) {
                if (videoFound) break; // Optimization: Stop if we found a video in this batch

                for (const node of mutation.addedNodes) {
                    if (node.nodeType !== Node.ELEMENT_NODE) continue;

                    if (node.nodeName === 'VIDEO') {
                        attachToVideo(node);
                        videoFound = true;
                        break;
                    }

                    // Optimization: Only querySelector if node might contain video (skip small text nodes etc, handled by nodeType check)
                    // and check children
                    if (node.getElementsByTagName) { // Ensure it's an element that can have children
                        const v = node.querySelector('video');
                        if (v) {
                            attachToVideo(v);
                            videoFound = true;
                            break;
                        }
                    }
                }
            }

            // Fallback
            if (!videoFound && !document.body.contains(videoElement)) {
                const v = document.querySelector('video');
                if (v) attachToVideo(v);
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });
    }

    // Initialize
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initObserver);
    } else {
        initObserver();
    }

    // Initial Scan
    const initialVideo = document.querySelector('video');
    if (initialVideo) attachToVideo(initialVideo);

    // Global URL change detection (SPA)
    // We use a persistent interval because handling 'popstate'/'hashchange' isn't enough for all SPA frameworks.
    // However, to prevent memory leaks in case this script is re-injected (unlikely in this context but possible),
    // we can attach it to the window object to clear previous ones.
    if (window._parentalSkipperInterval) {
        clearInterval(window._parentalSkipperInterval);
    }

    let lastUrl = window.location.href;
    window._parentalSkipperInterval = setInterval(() => {
        if (window.location.href !== lastUrl) {
            lastUrl = window.location.href;
            console.log('[Parental Skipper] 🧭 URL Changed');
            setTimeout(() => {
                const v = document.querySelector('video');
                if (v) attachToVideo(v);
                onVideoStateChange();
            }, 500);
        }
    }, 1000);

})();
