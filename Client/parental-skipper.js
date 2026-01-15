(function () {
    'use strict';

    // Remove Debug Overlay
    const existingOverlay = document.querySelector('div[style*="background:purple"]');
    if (existingOverlay) existingOverlay.remove();

    console.log('%c[Parental Skipper] Script loaded and initialized (v3.0).', 'color: #8b5cf6; font-size: 14px; font-weight: bold;');

    // State
    let currentSegments = [];
    let currentItemId = null;
    let isSkipping = false;
    let isEnabled = localStorage.getItem('parentalSkipperEnabled') !== 'false'; // Default ON
    let videoElement = null;
    let lastDetectedItemId = null;
    let settingsMenuObserver = null;

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
        const uuidPattern = '([a-f0-9]{32}|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})';
        const urlRegex = new RegExp(`\\/Items\\/${uuidPattern}`, 'i');
        const paramRegex = new RegExp(`[?&](?:ItemId|id)=${uuidPattern}`, 'i');

        const itemMatch = url.match(urlRegex) || url.match(paramRegex);

        if (itemMatch && itemMatch[1]) {
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

                // If we have segments, run a check immediately in case we are already in one
                if (currentSegments.length > 0 && videoElement) {
                    checkForSkip();
                }
            })
            .catch(err => {
                console.error('[Parental Skipper] Error fetching segments:', err);
            });
    }

    // --- Settings Menu Integration ---
    function injectSettingsButton(scroller) {
        // Prevent duplicate injection
        if (scroller.querySelector('#parental-skipper-menu-item')) return;

        console.log('[Parental Skipper] Injecting settings button...');

        const button = document.createElement('button');
        button.type = 'button';
        button.id = 'parental-skipper-menu-item';
        button.className = 'listItem listItem-button actionSheetMenuItem emby-button';
        button.innerHTML = `
            <div class="listItemBody">
                <div class="listItemBodyText">Parental Skipper</div>
                <div class="listItemBodyText secondary">${isEnabled ? 'Enabled' : 'Disabled'}</div>
            </div>
            <div class="listItemIconContainer">
                <span class="material-icons listItemIcon">${isEnabled ? 'check_circle' : 'cancel'}</span>
            </div>
        `;

        // Add click handler
        button.addEventListener('click', function(e) {
            // Toggle
            isEnabled = !isEnabled;
            localStorage.setItem('parentalSkipperEnabled', isEnabled);

            // Update UI
            const secondaryText = button.querySelector('.listItemBodyText.secondary');
            const icon = button.querySelector('.listItemIcon');

            if (secondaryText) secondaryText.textContent = isEnabled ? 'Enabled' : 'Disabled';
            if (icon) icon.textContent = isEnabled ? 'check_circle' : 'cancel';

            console.log(`[Parental Skipper] Toggled: ${isEnabled ? 'ON' : 'OFF'}`);

            // Close menu (optional, mimics native behavior)
            // const dialog = scroller.closest('.dialog');
            // if (dialog && dialog.close) dialog.close();
        });

        // Insert at the top or after Playback Speed
        // Try to find a good spot, otherwise prepend
        scroller.insertBefore(button, scroller.firstChild);
    }

    function initSettingsObserver() {
        if (settingsMenuObserver) return;

        // Watch the document body for the creation of the settings dialog
        // The dialog usually has class "actionSheet" and contains "actionSheetScroller"
        settingsMenuObserver = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                for (const node of mutation.addedNodes) {
                    if (node.nodeType !== Node.ELEMENT_NODE) continue;

                    // Check if this is the settings dialog or contains it
                    // Jellyfin usually creates a div with class "dialogContainer" or similar

                    // We look for the scroller directly
                    const scroller = node.classList?.contains('actionSheetScroller') ? node : node.querySelector('.actionSheetScroller');

                    if (scroller) {
                        // Check if this is the Video Settings menu
                        // It usually contains buttons like "Playback Speed", "Quality", etc.
                        // We can check the context or just assume if it's during video playback
                        if (videoElement) {
                             // Slight delay to ensure content is rendered
                             setTimeout(() => injectSettingsButton(scroller), 50);
                        }
                    }
                }
            }
        });

        settingsMenuObserver.observe(document.body, { childList: true, subtree: true });
        console.log('[Parental Skipper] Settings menu observer started');
    }

    // --- Core Logic ---
    function performSkip(segment) {
        if (isSkipping || !videoElement) return;

        isSkipping = true;
        const end = segment.End !== undefined ? segment.End : segment.end;

        console.log(`[Parental Skipper] 🚫 SKIPPING: ${videoElement.currentTime.toFixed(1)}s -> ${end}s`);
        // Notification Removed per user request

        // Seek
        videoElement.currentTime = end + 0.5; // +0.5s buffer

        // Cooldown
        setTimeout(() => {
            if (videoElement && videoElement.currentTime < end) {
                 videoElement.currentTime = end + 0.5;
            }
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
        if (window.playbackManager?.currentItem) {
            const item = window.playbackManager.currentItem();
            if (item && item.Id) return item.Id;
        }

        if (window.ApiClient?._playbackManager?.currentItem) {
            const item = window.ApiClient._playbackManager.currentItem();
            if (item && item.Id) return item.Id;
        }

        let id = null;
        if (window.location.hash && window.location.hash.includes('?')) {
            const hashParams = new URLSearchParams(window.location.hash.split('?')[1]);
            if (hashParams.has('id')) id = hashParams.get('id');
            else if (hashParams.has('videoId')) id = hashParams.get('videoId');
            else if (hashParams.has('itemId')) id = hashParams.get('itemId');
        }

        if (!id) {
             const searchParams = new URLSearchParams(window.location.search);
             if (searchParams.has('id')) id = searchParams.get('id');
             else if (searchParams.has('videoId')) id = searchParams.get('videoId');
             else if (searchParams.has('itemId')) id = searchParams.get('itemId');
        }

        if (id) return id;
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
        }
    }

    // --- Video Element Management ---
    function attachToVideo(video) {
        if (videoElement === video) return;

        if (videoElement) {
            videoElement.removeEventListener('timeupdate', checkForSkip);
            videoElement.removeEventListener('play', onVideoStateChange);
            videoElement.removeEventListener('loadeddata', onVideoStateChange);
        }

        videoElement = video;
        console.log('[Parental Skipper] 🎥 Video Element Attached');

        video.addEventListener('timeupdate', checkForSkip);
        video.addEventListener('play', onVideoStateChange);
        video.addEventListener('loadeddata', onVideoStateChange);

        onVideoStateChange();

        // Ensure settings observer is running
        initSettingsObserver();
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
                if (videoFound) break;

                for (const node of mutation.addedNodes) {
                    if (node.nodeType !== Node.ELEMENT_NODE) continue;

                    if (node.nodeName === 'VIDEO') {
                        attachToVideo(node);
                        videoFound = true;
                        break;
                    }

                    if (node.getElementsByTagName) {
                        const v = node.querySelector('video');
                        if (v) {
                            attachToVideo(v);
                            videoFound = true;
                            break;
                        }
                    }
                }
            }

            if (!videoFound && !document.body.contains(videoElement)) {
                const v = document.querySelector('video');
                if (v) attachToVideo(v);
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });

        // Also start the settings observer
        initSettingsObserver();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initObserver);
    } else {
        initObserver();
    }

    const initialVideo = document.querySelector('video');
    if (initialVideo) attachToVideo(initialVideo);

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
