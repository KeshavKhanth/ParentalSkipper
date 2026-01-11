using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Jellyfin.Database.Implementations.Enums;
using MediaBrowser.Controller.Entities;
using MediaBrowser.Controller.Entities.Movies;
using MediaBrowser.Controller.Entities.TV;
using MediaBrowser.Controller.MediaSegments;
using MediaBrowser.Model;
using MediaBrowser.Model.MediaSegments;
using Microsoft.Extensions.Logging;

namespace ParentalSkipper.Providers
{
    /// <summary>
    /// Parental Skipper media segment provider.
    /// Implements IMediaSegmentProvider to integrate with Jellyfin's native skip functionality.
    /// </summary>
    public class SegmentProvider : IMediaSegmentProvider
    {
        private readonly ILogger<SegmentProvider> _logger;

        /// <summary>
        /// Initializes a new instance of the <see cref="SegmentProvider"/> class.
        /// </summary>
        /// <param name="logger">Logger instance.</param>
        public SegmentProvider(ILogger<SegmentProvider> logger)
        {
            _logger = logger;
        }

        /// <inheritdoc/>
        public string Name => "Parental Skipper";

        /// <inheritdoc/>
        public Task<IReadOnlyList<MediaSegmentDto>> GetMediaSegments(MediaSegmentGenerationRequest request, CancellationToken cancellationToken)
        {
            ArgumentNullException.ThrowIfNull(request);

            var segments = new List<MediaSegmentDto>();

            if (Plugin.Instance == null)
            {
                _logger.LogWarning("[Parental Skipper] Plugin instance not available");
                return Task.FromResult<IReadOnlyList<MediaSegmentDto>>(segments);
            }

            try
            {
                using var db = new Data.ParentalSkipperDbContext(Plugin.Instance.DbPath);
                var itemSegments = db.Segments.Where(s => s.ItemId == request.ItemId).ToList();

                _logger.LogInformation("[Parental Skipper] SegmentProvider: Found {Count} segments for item {ItemId}", 
                    itemSegments.Count, request.ItemId);

                foreach (var segment in itemSegments)
                {
                    // Convert seconds to ticks (1 second = 10,000,000 ticks)
                    long startTicks = (long)(segment.Start * TimeSpan.TicksPerSecond);
                    long endTicks = (long)(segment.End * TimeSpan.TicksPerSecond);

                    segments.Add(new MediaSegmentDto
                    {
                        StartTicks = startTicks,
                        EndTicks = endTicks,
                        ItemId = request.ItemId,
                        Type = MediaSegmentType.Commercial // Use Commercial type for parental skip
                    });

                    _logger.LogInformation("[Parental Skipper] Added segment: {Start}s - {End}s (Ticks: {StartTicks} - {EndTicks})",
                        segment.Start, segment.End, startTicks, endTicks);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[Parental Skipper] Error getting segments for item {ItemId}", request.ItemId);
            }

            return Task.FromResult<IReadOnlyList<MediaSegmentDto>>(segments);
        }

        /// <inheritdoc/>
        public ValueTask<bool> Supports(BaseItem item) => ValueTask.FromResult(item is Episode or Movie);
    }
}
