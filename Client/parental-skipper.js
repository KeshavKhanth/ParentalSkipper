(function () {
    'use strict';

    console.log('[Parental Skipper] Script loaded.');

    let currentSegments = [];
    let currentItemId = null;
    let isSkipping = false;

    function fetchSegments(itemId) {
        if (!itemId) return;
        
        console.log('[Parental Skipper] Fetching segments for item:', itemId);
        const apiClient = window.ApiClient;
        if (!apiClient) {
            console.warn('[Parental Skipper] ApiClient not found.');
            return;
        }

        const url = apiClient.getUrl('ParentalSkipper/Segments/' + itemId);
        
        apiClient.fetch({
            url: url,
            method: 'GET'
        }).then(function (response) {
            return response.json();
        }).then(function (segments) {
            currentSegments = segments || [];
            console.log('[Parental Skipper] Segments loaded:', currentSegments);
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
                console.log('[Parental Skipper] Skipping restricted scene:', segment.Start, '->', segment.End);
                
                // Show notification if enabled (optional, can be implemented using dashboard Toast)
                // Dashboard.alert('Skipping restricted scene'); 

                isSkipping = true;
                mediaElement.currentTime = segment.End;
                
                // Prevent stuttering
                setTimeout(() => {
                    isSkipping = false;
                }, 1000);
                
                break;
            }
        }
    }

    function attachToPlayer() {
        const mediaElements = document.querySelectorAll('video');
        mediaElements.forEach(video => {
            if (!video.dataset.parentalSkipperAttached) {
                video.addEventListener('timeupdate', onTimeUpdate);
                video.dataset.parentalSkipperAttached = 'true';
                console.log('[Parental Skipper] Attached to video element.');
            }
        });
    }

    // Monitor for playback start
    document.addEventListener('viewshow', function (e) {
        // Jellyfin "viewshow" event is useful to detect page navigation
        // But for playback, we might need to hook into the playback manager or just observe DOM
        // Simple approach: Use a MutationObserver or periodic check for video elements
    });

    // Periodically check for video elements (simple and robust for most web players)
    setInterval(attachToPlayer, 2000);

    // Hook into Jellyfin's playback events if possible to get ItemId
    // Standard Jellyfin web client exposes 'playbackstart' events on the document or via playbackManager
    document.addEventListener('playbackstart', function(e) {
        // e.detail might contain item info
        // Or we can try to get the current item from the router or player
        console.log('[Parental Skipper] Playback start detected', e);
        
        // Try to find the item ID. This is tricky without deep integration.
        // Often stored in the URL or the player state.
        // Hacky way: Check URL hash
        const hash = window.location.hash;
        // ex: #/video?id=...&serverId=...
        // URLSearchParams is useful here
        if (hash.indexOf('id=') !== -1) {
            const params = new URLSearchParams(hash.split('?')[1]);
            const id = params.get('id');
            if (id && id !== currentItemId) {
                currentItemId = id;
                fetchSegments(id);
            }
        }
    });
    
    // Also try to hook into the global 'playbackManager' if available
    // Note: This script runs in the browser context.
    
})();
