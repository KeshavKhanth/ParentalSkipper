using System;
using System.Threading;
using System.Threading.Tasks;
using MediaBrowser.Controller.Library;
using MediaBrowser.Controller.MediaSegments;
using MediaBrowser.Model.Configuration;
using Microsoft.Extensions.Logging;

namespace ParentalSkipper.Manager
{
    /// <summary>
    /// Manages media segment updates by triggering Jellyfin to query our segment provider.
    /// </summary>
    public class MediaSegmentUpdateManager
    {
        private readonly IMediaSegmentManager _mediaSegmentManager;
        private readonly ILibraryManager _libraryManager;
        private readonly ILogger<MediaSegmentUpdateManager> _logger;
        
        // Library options to include our provider
        private readonly LibraryOptions _providerOptions = new()
        {
            DisabledMediaSegmentProviders = Array.Empty<string>()
        };

        /// <summary>
        /// Initializes a new instance of the <see cref="MediaSegmentUpdateManager"/> class.
        /// </summary>
        public MediaSegmentUpdateManager(
            IMediaSegmentManager mediaSegmentManager,
            ILibraryManager libraryManager,
            ILogger<MediaSegmentUpdateManager> logger)
        {
            _mediaSegmentManager = mediaSegmentManager;
            _libraryManager = libraryManager;
            _logger = logger;
        }

        /// <summary>
        /// Updates media segments for a specific item by triggering Jellyfin to query providers.
        /// </summary>
        /// <param name="itemId">The item ID to update segments for.</param>
        /// <param name="cancellationToken">Cancellation token.</param>
        /// <returns>A task representing the async operation.</returns>
        public async Task UpdateSegmentsForItemAsync(Guid itemId, CancellationToken cancellationToken = default)
        {
            try
            {
                var item = _libraryManager.GetItemById(itemId);
                if (item == null)
                {
                    _logger.LogWarning("[Parental Skipper] Item {ItemId} not found in library", itemId);
                    return;
                }

                _logger.LogInformation("[Parental Skipper] Triggering segment update for item {ItemId} ({Name})", 
                    itemId, item.Name);

                // This tells Jellyfin to query all IMediaSegmentProvider implementations
                // including our SegmentProvider, and store the results
                await _mediaSegmentManager.RunSegmentPluginProviders(item, _providerOptions, true, cancellationToken)
                    .ConfigureAwait(false);

                _logger.LogInformation("[Parental Skipper] Segment update completed for item {ItemId}", itemId);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[Parental Skipper] Error updating segments for item {ItemId}", itemId);
            }
        }
    }
}
