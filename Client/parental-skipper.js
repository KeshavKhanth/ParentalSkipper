(function () {
    'use strict';

    // DEBUG: Visual indicator that script is loaded
    const debugOverlay = document.createElement('div');
    debugOverlay.style.cssText = 'position:fixed;top:0;left:0;background:red;color:white;z-index:999999;padding:5px;font-size:12px;pointer-events:none;';
    debugOverlay.textContent = 'Parental Skipper Loaded';
    document.body.appendChild(debugOverlay);
    setTimeout(() => debugOverlay.remove(), 5000);

    console.log('%c[Parental Skipper] Script loaded and initialized.', 'color: #22c55e; font-size: 14px; font-weight: bold;');

    let currentSegments = [];
    let currentItemId = null;
    let isSkipping = false;
    let isEnabled = localStorage.getItem('parentalSkipperEnabled') !== 'false'; // Default ON
    let toggleButton = null;
    let skipNotification = null;
    let videoElement = null;
    let playbackMonitorInterval = null;
    let lastPlaybackTime = -1;
    let lastDetectedItemId = null; // Cache for item ID from network requests

    // Intercept fetch requests to detect item IDs
    const originalFetch = window.fetch;
    window.fetch = function (...args) {
        const url = args[0]?.url || args[0];
        if (typeof url === 'string') {
            // Look for item ID in URL patterns like /Items/{itemId} or /PlaybackInfo
            const itemMatch = url.match(/\/Items\/([a-f0-9-]+)/i) ||
                url.match(/\/Users\/[^/]+\/Items\/([a-f0-9-]+)/i);
            if (itemMatch) {
                lastDetectedItemId = itemMatch[1];
                console.log('[Parental Skipper] 🔍 Detected item ID from fetch:', lastDetectedItemId);
            }
        }
        return originalFetch.apply(this, args);
    };

    // Also intercept XMLHttpRequest
    const originalXHROpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (method, url, ...rest) {
        if (typeof url === 'string') {
            const itemMatch = url.match(/\/Items\/([a-f0-9-]+)/i) ||
                url.match(/\/Users\/[^/]+\/Items\/([a-f0-9-]+)/i);
            if (itemMatch) {
                lastDetectedItemId = itemMatch[1];
                console.log('[Parental Skipper] 🔍 Detected item ID from XHR:', lastDetectedItemId);
            }
        }
        return originalXHROpen.apply(this, [method, url, ...rest]);
    };

    console.log('[Parental Skipper] 🔧 Network interception installed');

    // Get authorization header for API calls
    function getAuthHeader() {
        const apiClient = window.ApiClient;
        if (!apiClient) return null;

        return 'MediaBrowser Client="Jellyfin Web", Device="Browser", DeviceId="' +
            (apiClient.deviceId ? apiClient.deviceId() : 'unknown') +
            '", Version="' + (apiClient.appVersion ? apiClient.appVersion() : '10.8.0') +
            '", Token="' + (apiClient.accessToken ? apiClient.accessToken() : '') + '"';
    }

    function fetchSegments(itemId) {
        if (!itemId) {
            console.error('[Parental Skipper] ❌ fetchSegments called with empty itemId');
            return;
        }

        console.log(`%c[Parental Skipper] Fetching segments for item: ${itemId}`, 'color: #0ea5e9; font-weight: bold;');

        const apiClient = window.ApiClient;
        if (!apiClient) {
            console.warn('[Parental Skipper] ⚠️ ApiClient not ready, retrying in 1s...');
            setTimeout(() => fetchSegments(itemId), 1000);
            return;
        }

        const baseUrl = apiClient.serverAddress ? apiClient.serverAddress() : '';
        const url = baseUrl + '/ParentalSkipper/Segments/' + itemId;
        console.log('[Parental Skipper] Request URL:', url);

        const authHeader = getAuthHeader();
        const headers = {};
        if (authHeader) {
            headers['X-Emby-Authorization'] = authHeader;
        }

        fetch(url, { headers: headers })
            .then(function (response) {
                if (!response.ok) {
                    throw new Error('HTTP ' + response.status);
                }
                return response.json();
            })
            .then(function (segments) {
                currentSegments = segments || [];
                console.log('[Parental Skipper] ✅ Loaded ' + currentSegments.length + ' segments');

                if (currentSegments.length > 0) {
                    console.log('[Parental Skipper] Segments:', JSON.stringify(currentSegments, null, 2));
                } else {
                    console.log('[Parental Skipper] No segments defined for this item.');
                }

                updateToggleButtonBadge();
            })
            .catch(function (err) {
                console.error('[Parental Skipper] Error fetching segments:', err);
            });
    }

    function showSkipNotification(segment) {
        // Remove existing notification
        const existing = document.getElementById('parental-skipper-notification');
        if (existing) existing.remove();

        skipNotification = document.createElement('div');
        skipNotification.id = 'parental-skipper-notification';
        skipNotification.style.cssText = `
            position: fixed;
            top: 50px;
            left: 50%;
            transform: translateX(-50%);
            background: linear-gradient(135deg, #dc2626, #b91c1c);
            color: white;
            padding: 16px 32px;
            border-radius: 12px;
            font-size: 18px;
            font-weight: bold;
            z-index: 999999;
            box-shadow: 0 8px 32px rgba(0,0,0,0.5);
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            animation: parentalSkipperFadeIn 0.3s ease-out;
        `;

        // Add animation keyframes if not already present
        if (!document.getElementById('parental-skipper-styles')) {
            const styleEl = document.createElement('style');
            styleEl.id = 'parental-skipper-styles';
            styleEl.textContent = `
                @keyframes parentalSkipperFadeIn {
                    from { opacity: 0; transform: translateX(-50%) translateY(-20px); }
                    to { opacity: 1; transform: translateX(-50%) translateY(0); }
                }
            `;
            document.head.appendChild(styleEl);
        }

        skipNotification.innerHTML = '⏩ <span style="margin-left:8px;">Skipping: ' + (segment.Reason || 'Restricted Content') + '</span>';
        document.body.appendChild(skipNotification);

        setTimeout(function () {
            const notif = document.getElementById('parental-skipper-notification');
            if (notif) notif.remove();
        }, 2500);
    }

    function performSkip(video, segment) {
        if (isSkipping) return;

        // Handle both PascalCase and camelCase property names
        const start = segment.Start !== undefined ? segment.Start : segment.start;
        const end = segment.End !== undefined ? segment.End : segment.end;
        const reason = segment.Reason !== undefined ? segment.Reason : segment.reason;

        console.log('[Parental Skipper] 🚫 SKIPPING segment:', start + 's -> ' + end + 's (Reason: ' + (reason || 'none') + ')');

        isSkipping = true;
        showSkipNotification({ Reason: reason });

        // Perform the skip
        video.currentTime = end + 0.5; // Add small buffer

        // Reset skip flag after cooldown
        setTimeout(function () {
            isSkipping = false;
            console.log('[Parental Skipper] Skip cooldown ended');
        }, 2000);
    }

    function checkForSkip() {
        // Re-acquire video element if current one is stale (not in DOM anymore)
        if (!videoElement || !document.body.contains(videoElement)) {
            const videos = document.querySelectorAll('video');
            if (videos.length > 0) {
                for (let i = 0; i < videos.length; i++) {
                    if (videos[i].readyState > 0 || videos[i].currentTime > 0) {
                        if (videos[i] !== videoElement) {
                            console.log('[Parental Skipper] 🔄 Re-acquired video element');
                            videoElement = videos[i];

                            // Re-fetch segments if item ID changed
                            const itemId = getItemIdFromPlaybackManager();
                            if (itemId && itemId !== currentItemId) {
                                currentItemId = itemId;
                                currentSegments = [];
                                console.log('[Parental Skipper] New item on video switch:', itemId);
                                fetchSegments(itemId);
                            }
                        }
                        break;
                    }
                }
            }
        }

        if (!isEnabled || isSkipping || currentSegments.length === 0 || !videoElement) {
            return;
        }

        const currentTime = videoElement.currentTime;

        // Debug: Log every 30 seconds to confirm monitoring is working
        const currentSecond = Math.floor(currentTime);
        if (currentSecond > 0 && currentSecond % 30 === 0 && currentSecond !== Math.floor(lastPlaybackTime)) {
            console.log(`[Parental Skipper] ⏱️ Monitoring: ${currentTime.toFixed(1)}s (Segments: ${currentSegments.length})`);
        }

        // Avoid checking the same second repeatedly
        if (Math.floor(currentTime) === Math.floor(lastPlaybackTime)) {
            return;
        }
        lastPlaybackTime = currentTime;

        for (let i = 0; i < currentSegments.length; i++) {
            const segment = currentSegments[i];
            let start = Number(segment.Start !== undefined ? segment.Start : segment.start);
            let end = Number(segment.End !== undefined ? segment.End : segment.end);

            // Log when approaching segment (within 3 seconds)
            if (currentTime >= (start - 3) && currentTime < start) {
                console.log(`[Parental Skipper] ⏳ Approaching skip in ${(start - currentTime).toFixed(1)}s`);
            }

            // Check if we're within the segment bounds
            if (currentTime >= start && currentTime < end) {
                console.log(`[Parental Skipper] 🎯 SKIP! ${currentTime.toFixed(1)}s → ${end}s`);
                performSkip(videoElement, segment);
                return;
            }
        }
    }

    // Helper function to convert HH:MM:SS or MM:SS to seconds
    function parseTimeToSeconds(timeStr) {
        if (!timeStr || typeof timeStr !== 'string') return 0;
        const parts = timeStr.split(':').map(Number);
        if (parts.length === 3) {
            // HH:MM:SS
            return parts[0] * 3600 + parts[1] * 60 + parts[2];
        } else if (parts.length === 2) {
            // MM:SS
            return parts[0] * 60 + parts[1];
        }
        return parseFloat(timeStr) || 0;
    }

    function updateToggleButtonBadge() {
        if (!toggleButton) return;

        // Clear and rebuild
        toggleButton.innerHTML = '';

        const text = document.createElement('span');
        text.textContent = isEnabled ? '🛡️ ON' : '🛡️ OFF';
        toggleButton.appendChild(text);

        if (currentSegments.length > 0) {
            const badge = document.createElement('span');
            badge.textContent = ' (' + currentSegments.length + ')';
            badge.style.cssText = 'font-size: 12px; opacity: 0.9;';
            toggleButton.appendChild(badge);
        }
    }

    function createToggleButton() {
        // Remove existing button
        const existing = document.getElementById('parental-skipper-toggle');
        if (existing) existing.remove();

        toggleButton = document.createElement('button');
        toggleButton.id = 'parental-skipper-toggle';
        toggleButton.style.cssText = `
            position: fixed;
            bottom: 100px;
            right: 20px;
            background: ${isEnabled ? '#22c55e' : '#6b7280'};
            color: white;
            border: none;
            padding: 12px 20px;
            border-radius: 10px;
            font-size: 14px;
            font-weight: bold;
            cursor: pointer;
            z-index: 999998;
            box-shadow: 0 4px 15px rgba(0,0,0,0.4);
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            transition: background 0.2s ease, transform 0.1s ease;
        `;

        updateToggleButtonBadge();

        toggleButton.onmouseenter = function () {
            toggleButton.style.transform = 'scale(1.05)';
        };
        toggleButton.onmouseleave = function () {
            toggleButton.style.transform = 'scale(1)';
        };

        toggleButton.onclick = function (e) {
            e.preventDefault();
            e.stopPropagation();

            isEnabled = !isEnabled;
            localStorage.setItem('parentalSkipperEnabled', isEnabled);
            toggleButton.style.background = isEnabled ? '#22c55e' : '#6b7280';
            updateToggleButtonBadge();

            console.log('[Parental Skipper] Toggled:', isEnabled ? 'ON' : 'OFF');
        };

        document.body.appendChild(toggleButton);
        console.log('[Parental Skipper] ✅ Toggle button created');
    }

    function removeToggleButton() {
        const btn = document.getElementById('parental-skipper-toggle');
        if (btn) btn.remove();
        toggleButton = null;
    }

    // Extract item ID using multiple methods (Jellyfin 10.11 compatible)
    function getItemIdFromPlaybackManager() {
        // Method 0: Use item ID captured from network interception (most reliable)
        if (lastDetectedItemId) {
            console.log('[Parental Skipper] ✅ Using item ID from network interception:', lastDetectedItemId);
            return lastDetectedItemId;
        }

        // Method 1: Try window.playbackManager (Jellyfin 10.11+)
        try {
            if (window.playbackManager) {
                const currentItem = window.playbackManager.currentItem();
                if (currentItem && currentItem.Id) {
                    console.log('[Parental Skipper] ✅ Got item ID from window.playbackManager:', currentItem.Id);
                    return currentItem.Id;
                }
            }
        } catch (e) {
            console.log('[Parental Skipper] playbackManager method 1 failed:', e.message);
        }

        // Method 2: Try ApiClient.playbackManager
        try {
            if (window.ApiClient && window.ApiClient._playbackManager) {
                const currentItem = window.ApiClient._playbackManager.currentItem();
                if (currentItem && currentItem.Id) {
                    console.log('[Parental Skipper] ✅ Got item ID from ApiClient._playbackManager:', currentItem.Id);
                    return currentItem.Id;
                }
            }
        } catch (e) {
            console.log('[Parental Skipper] playbackManager method 2 failed:', e.message);
        }

        // Method 3: Try require (older Jellyfin)
        try {
            const playbackManager = window.require ? window.require('playbackManager') : null;
            if (playbackManager) {
                const currentItem = playbackManager.currentItem();
                if (currentItem && currentItem.Id) {
                    console.log('[Parental Skipper] ✅ Got item ID from require(playbackManager):', currentItem.Id);
                    return currentItem.Id;
                }
            }
        } catch (e) {
            console.log('[Parental Skipper] playbackManager method 3 failed:', e.message);
        }

        // Method 4: Look for data attributes on video element
        try {
            const video = document.querySelector('video');
            if (video) {
                // Check parent elements for data attributes
                let parent = video.parentElement;
                for (let i = 0; i < 10 && parent; i++) {
                    const itemId = parent.getAttribute('data-itemid') ||
                        parent.getAttribute('data-id') ||
                        parent.dataset?.itemid ||
                        parent.dataset?.id;
                    if (itemId) {
                        console.log('[Parental Skipper] ✅ Got item ID from data attribute:', itemId);
                        return itemId;
                    }
                    parent = parent.parentElement;
                }
            }
        } catch (e) {
            console.log('[Parental Skipper] data attribute method failed:', e.message);
        }

        // Method 5: Try to find it in Jellyfin's global state
        try {
            if (window.Emby && window.Emby.Page && window.Emby.Page.currentId) {
                console.log('[Parental Skipper] ✅ Got item ID from Emby.Page.currentId:', window.Emby.Page.currentId);
                return window.Emby.Page.currentId;
            }
        } catch (e) {
            console.log('[Parental Skipper] Emby.Page method failed:', e.message);
        }

        // Method 6: Fallback to URL
        return extractItemIdFromUrl();
    }

    function extractItemIdFromUrl() {
        const url = window.location.href;
        const hash = window.location.hash || '';

        // Pattern 1: id= in hash (most common)
        let match = hash.match(/[?&]id=([a-f0-9-]+)/i);
        if (match) {
            console.log('[Parental Skipper] Found ID in hash:', match[1]);
            return match[1];
        }

        // Pattern 2: id= in query string
        match = url.match(/[?&]id=([a-f0-9-]+)/i);
        if (match) {
            console.log('[Parental Skipper] Found ID in query:', match[1]);
            return match[1];
        }

        // Pattern 3: /Items/xxx/ in path
        match = url.match(/\/Items\/([a-f0-9-]+)/i);
        if (match) {
            console.log('[Parental Skipper] Found ID in path:', match[1]);
            return match[1];
        }

        // Pattern 4: video=xxx in hash
        match = hash.match(/video=([a-f0-9-]+)/i);
        if (match) {
            console.log('[Parental Skipper] Found ID in video param:', match[1]);
            return match[1];
        }

        // Pattern 5: playback?id=xxx
        match = url.match(/playback[^?]*\?.*id=([a-f0-9-]+)/i);
        if (match) {
            console.log('[Parental Skipper] Found ID in playback URL:', match[1]);
            return match[1];
        }

        console.log('[Parental Skipper] Could not extract item ID from URL:', url);
        return null;
    }

    function startPlaybackMonitor() {
        if (playbackMonitorInterval) {
            clearInterval(playbackMonitorInterval);
        }

        // Check every 500ms for playback position
        playbackMonitorInterval = setInterval(checkForSkip, 500);
        console.log('[Parental Skipper] ✅ Playback monitor started (checking every 500ms)');
    }

    function stopPlaybackMonitor() {
        if (playbackMonitorInterval) {
            clearInterval(playbackMonitorInterval);
            playbackMonitorInterval = null;
        }
        lastPlaybackTime = -1;
    }

    function onVideoFound(video) {
        if (video === videoElement) return;

        videoElement = video;
        console.log('[Parental Skipper] ✅ Video element found');

        // Extract item ID
        const itemId = getItemIdFromPlaybackManager();
        if (itemId) {
            if (itemId !== currentItemId) {
                currentItemId = itemId;
                currentSegments = [];
                console.log('[Parental Skipper] New item detected:', itemId);
                fetchSegments(itemId);
            }
        } else {
            console.warn('[Parental Skipper] No item ID found');
        }

        // Create toggle button
        createToggleButton();

        // Start monitoring playback
        startPlaybackMonitor();

        // Listen for video events
        video.addEventListener('ended', function () {
            console.log('[Parental Skipper] Video ended');
            stopPlaybackMonitor();
        });

        video.addEventListener('pause', function () {
            console.log('[Parental Skipper] Video paused at', video.currentTime + 's');
        });

        video.addEventListener('play', function () {
            console.log('[Parental Skipper] Video playing from', video.currentTime + 's');
        });

        // Listen for seeking to reset skip flag
        video.addEventListener('seeked', function () {
            isSkipping = false;
            lastPlaybackTime = -1;
        });
    }

    function scanForVideo() {
        const videos = document.querySelectorAll('video');

        if (videos.length > 0) {
            // Find the main video (usually the largest or first one)
            let mainVideo = videos[0];
            for (let i = 0; i < videos.length; i++) {
                if (videos[i].videoWidth > 0 || videos[i].readyState > 0) {
                    mainVideo = videos[i];
                    break;
                }
            }
            onVideoFound(mainVideo);
        } else {
            // No video found
            if (videoElement) {
                console.log('[Parental Skipper] Video element removed');
                videoElement = null;
                stopPlaybackMonitor();
                removeToggleButton();
            }
        }
    }

    // Hook into Jellyfin Events if available
    function setupJellyfinEventHooks() {
        try {
            // Try to hook into Jellyfin's event system
            if (window.Events) {
                window.Events.on('playbackstart', function (e, player, state) {
                    console.log('[Parental Skipper] Playback started event received');
                    if (state && state.NowPlayingItem && state.NowPlayingItem.Id) {
                        const itemId = state.NowPlayingItem.Id;
                        if (itemId !== currentItemId) {
                            currentItemId = itemId;
                            currentSegments = [];
                            console.log('[Parental Skipper] Item ID from playback event:', itemId);
                            fetchSegments(itemId);
                        }
                    }
                });

                window.Events.on('playbackstop', function () {
                    console.log('[Parental Skipper] Playback stopped event received');
                    stopPlaybackMonitor();
                    removeToggleButton();
                    currentItemId = null;
                    currentSegments = [];
                });

                console.log('[Parental Skipper] ✅ Jellyfin event hooks registered');
            }
        } catch (e) {
            console.log('[Parental Skipper] Could not register Jellyfin event hooks:', e);
        }
    }

    // Main initialization
    function init() {
        console.log('[Parental Skipper] Initializing...');
        console.log('[Parental Skipper] Current URL:', window.location.href);
        console.log('[Parental Skipper] Skipper enabled:', isEnabled);

        // Setup Jellyfin event hooks
        setupJellyfinEventHooks();

        // Scan for video elements every second
        setInterval(scanForVideo, 1000);

        // Watch for URL changes (SPA navigation)
        let lastUrl = window.location.href;
        setInterval(function () {
            if (window.location.href !== lastUrl) {
                lastUrl = window.location.href;
                console.log('[Parental Skipper] URL changed to:', lastUrl);

                // Reset state for new page
                currentItemId = null;
                currentSegments = [];
                lastPlaybackTime = -1;

                // Scan for video on new page
                scanForVideo();
            }
        }, 500);

        // Initial scan
        scanForVideo();

        console.log('[Parental Skipper] ✅ Initialization complete');
    }

    // Start when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();

