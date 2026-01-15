using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using ParentalSkipper.Data;
using ParentalSkipper.Manager;
using System.Net.Mime;
using Microsoft.Extensions.Logging;

namespace ParentalSkipper.Controllers
{
    /// <summary>
    /// Parental Skipper API controller for managing skip segments.
    /// </summary>
    [ApiController]
    [Route("ParentalSkipper")]
    [Produces(MediaTypeNames.Application.Json)]
    public class ParentalSkipperController : ControllerBase
    {
        private readonly ILogger<ParentalSkipperController> _logger;
        private readonly MediaSegmentUpdateManager _segmentUpdateManager;

        public ParentalSkipperController(
            ILogger<ParentalSkipperController> logger,
            MediaSegmentUpdateManager segmentUpdateManager)
        {
            _logger = logger;
            _segmentUpdateManager = segmentUpdateManager;
        }

        /// <summary>
        /// Gets the client-side skip script.
        /// </summary>
        /// <returns>JavaScript file content.</returns>
        [HttpGet("ClientScript")]
        [AllowAnonymous]
        [Produces("application/javascript")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        public ActionResult GetClientScript()
        {
            var assembly = typeof(ParentalSkipperController).Assembly;
            var resourceName = "ParentalSkipper.Client.parental-skipper.js";

            using (var stream = assembly.GetManifestResourceStream(resourceName))
            {
                if (stream == null)
                    return NotFound();

                using (var reader = new System.IO.StreamReader(stream))
                {
                    return Content(reader.ReadToEnd(), "application/javascript");
                }
            }
        }

        /// <summary>
        /// Gets all segments for a media item.
        /// </summary>
        /// <param name="itemId">The Jellyfin item ID.</param>
        /// <returns>List of segments for the item.</returns>
        [HttpGet("Segments/{itemId}")]
        [AllowAnonymous]
        [ProducesResponseType(StatusCodes.Status200OK)]
        public ActionResult<List<Segment>> GetSegments([FromRoute] Guid itemId)
        {
            using var db = new Data.ParentalSkipperDbContext(Plugin.Instance!.DbPath);
            var segments = db.Segments.Where(s => s.ItemId == itemId).ToList();
            _logger.LogInformation("[Parental Skipper] Retrieved {Count} segments for item {ItemId}", segments.Count, itemId);
            return Ok(segments);
        }

        /// <summary>
        /// Gets all configured segments grouped by item.
        /// </summary>
        /// <returns>Dictionary of segments keyed by ItemId.</returns>
        [HttpGet("Segments")]
        [Authorize(Policy = "RequiresElevation")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        public ActionResult<Dictionary<Guid, List<Segment>>> GetAllSegments()
        {
            using var db = new Data.ParentalSkipperDbContext(Plugin.Instance!.DbPath);
            var segments = db.Segments.ToList();

            var grouped = segments
                .GroupBy(s => s.ItemId)
                .ToDictionary(g => g.Key, g => g.ToList());

            _logger.LogInformation("[Parental Skipper] Retrieved all segments for {Count} items", grouped.Count);
            return Ok(grouped);
        }

        /// <summary>
        /// Adds a new segment for a media item and triggers segment refresh.
        /// </summary>
        /// <param name="request">Segment data.</param>
        /// <returns>Success status.</returns>
        [HttpPost("Segments")]
        [Authorize(Policy = "RequiresElevation")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [Consumes(MediaTypeNames.Application.Json)]
        public async Task<ActionResult> AddSegment([FromBody] SegmentDto request)
        {
            // Simple validation
            if (request.Start >= request.End)
            {
                _logger.LogWarning("[Parental Skipper] Invalid segment: Start {Start} >= End {End}", request.Start, request.End);
                return BadRequest("Start time must be less than End time.");
            }

            using var db = new Data.ParentalSkipperDbContext(Plugin.Instance!.DbPath);
            var segment = new Segment
            {
                ItemId = request.ItemId,
                Start = request.Start,
                End = request.End,
                Reason = request.Reason ?? string.Empty
            };
            db.Segments.Add(segment);
            db.SaveChanges();
            
            _logger.LogInformation("[Parental Skipper] Added segment for item {ItemId}: {Start}s - {End}s", 
                request.ItemId, request.Start, request.End);

            // Trigger Jellyfin to refresh segments for this item
            await _segmentUpdateManager.UpdateSegmentsForItemAsync(request.ItemId).ConfigureAwait(false);
            
            return Ok();
        }

        /// <summary>
        /// Deletes a segment by ID and triggers segment refresh.
        /// </summary>
        /// <param name="id">Segment ID.</param>
        /// <returns>Success status.</returns>
        [HttpDelete("Segments/{id}")]
        [Authorize(Policy = "RequiresElevation")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        public async Task<ActionResult> DeleteSegment([FromRoute] int id)
        {
            using var db = new Data.ParentalSkipperDbContext(Plugin.Instance!.DbPath);
            var segment = db.Segments.Find(id);
            if (segment == null)
            {
                _logger.LogWarning("[Parental Skipper] Segment {Id} not found for deletion", id);
                return NotFound();
            }
            
            var itemId = segment.ItemId;
            _logger.LogInformation("[Parental Skipper] Deleted segment {Id} for item {ItemId}", 
                segment.Id, segment.ItemId);
            
            db.Segments.Remove(segment);
            db.SaveChanges();

            // Trigger Jellyfin to refresh segments for this item
            await _segmentUpdateManager.UpdateSegmentsForItemAsync(itemId).ConfigureAwait(false);

            return Ok();
        }
    }

    public class SegmentDto
    {
        public Guid ItemId { get; set; }
        public double Start { get; set; }
        public double End { get; set; }
        public string? Reason { get; set; }
    }
}
