(function () {
    'use strict';

    console.log('[Parental Skipper] Script loaded and initialized.');

    let currentSegments = [];
    let currentItemId = null;
    let isSkipping = false;

    function fetchSegments(itemId) {
        if (!itemId) {
            console.warn('[Parental Skipper] fetchSegments called with empty itemId');
            return;
        }
        
        console.log('[Parental Skipper] Fetching segments for item:', itemId);
        const apiClient = window.ApiClient;
        if (!apiClient) {
            console.warn('[Parental Skipper] ApiClient not found, retrying in 1s...');
            setTimeout(() => fetchSegments(itemId), 1000);
            return;
        }

        const url = apiClient.getUrl('ParentalSkipper/Segments/' + itemId);
        console.log('[Parental Skipper] Fetching from URL:', url);
        
        apiClient.fetch({
            url: url,
            method: 'GET'
        }).then(function (response) {
            return response.json();
        }).then(function (segments) {
            currentSegments = segments || [];
            console.log('[Parental Skipper] Loaded ' + currentSegments.length + ' segments:', currentSegments);
            if (currentSegments.length === 0) {
                console.log('[Parental Skipper] No segments defined for this item.');
            }
        }).catch(function (err) {
            console.error('[Parental Skipper] Error fetching segments:', err);
        });
    }

    function onTimeUpdate(e) {
        if (isSkipping || currentSegments.length === 0) return;

        const mediaElement = e.target;
        const currentTime = mediaElement.currentTime;

        for (const segment of currentSegments) {
            if (currentTime >= segment.Start && currentTime < segment.End) {
                console.log('[Parental Skipper] 🚫 Skipping segment:', segment.Start + 's -> ' + segment.End + 's (Reason: ' + (segment.Reason || 'none') + ')');
                
                isSkipping = true;
                mediaElement.currentTime = segment.End;
                
                // Prevent stuttering by blocking re-entry
                setTimeout(() => {
                    isSkipping = false;
                }, 1000);
                
                break;
            }
        }
    }

    function attachToPlayer() {
        const mediaElements = document.querySelectorAll('video');
        if (mediaElements.length > 0) {
            mediaElements.forEach(video => {
                if (!video.dataset.parentalSkipperAttached) {
                    video.addEventListener('timeupdate', onTimeUpdate);
                    video.dataset.parentalSkipperAttached = 'true';
                    console.log('[Parental Skipper] ✅ Attached to video element');
                }
            });
        }
    }

    // Periodically check for video elements (robust for web player)
    setInterval(attachToPlayer, 2000);

    // Hook into Jellyfin's playback events to get ItemId
    document.addEventListener('playbackstart', function(e) {
        console.log('[Parental Skipper] Playback start detected', e);
        
        // Try to find the item ID from URL hash
        const hash = window.location.hash;
        console.log('[Parental Skipper] Current URL hash:', hash);
        
        if (hash.indexOf('id=') !== -1) {
            const params = new URLSearchParams(hash.split('?')[1]);
            const id = params.get('id');
            if (id && id !== currentItemId) {
                console.log('[Parental Skipper] Detected new item:', id);
                currentItemId = id;
                currentSegments = []; // Clear old segments
                fetchSegments(id);
            }
        } else {
            console.warn('[Parental Skipper] Could not extract item ID from URL');
        }
    });
    
    // Also monitor URL changes
    let lastUrl = window.location.href;
    setInterval(function() {
        const currentUrl = window.location.href;
        if (currentUrl !== lastUrl) {
            lastUrl = currentUrl;
            const hash = window.location.hash;
            if (hash.indexOf('id=') !== -1 && hash.indexOf('/video') !== -1) {
                const params = new URLSearchParams(hash.split('?')[1]);
                const id = params.get('id');
                if (id && id !== currentItemId) {
                    console.log('[Parental Skipper] URL changed, detected new item:', id);
                    currentItemId = id;
                    currentSegments = [];
                    fetchSegments(id);
                }
            }
        }
    }, 1000);
    
})();
