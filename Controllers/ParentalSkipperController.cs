using System;
using System.Collections.Generic;
using System.Linq;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using ParentalSkipper.Data;
using System.Net.Mime;
using Microsoft.Extensions.Logging;

namespace ParentalSkipper.Controllers
{
    /// <summary>
    /// Parental Skipper API controller for managing skip segments.
    /// </summary>
    [Authorize(Policy = "RequiresElevation")]
    [ApiController]
    [Route("ParentalSkipper")]
    [Produces(MediaTypeNames.Application.Json)]
    public class ParentalSkipperController : ControllerBase
    {
        private readonly ILogger<ParentalSkipperController> _logger;

        public ParentalSkipperController(ILogger<ParentalSkipperController> logger)
        {
            _logger = logger;
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
        [ProducesResponseType(StatusCodes.Status200OK)]
        public ActionResult<List<Segment>> GetSegments([FromRoute] Guid itemId)
        {
            using var db = new Data.ParentalSkipperDbContext(Plugin.Instance.DbPath);
            var segments = db.Segments.Where(s => s.ItemId == itemId).ToList();
            _logger.LogInformation("[Parental Skipper] Retrieved {Count} segments for item {ItemId}", segments.Count, itemId);
            return Ok(segments);
        }

        /// <summary>
        /// Adds a new segment for a media item.
        /// </summary>
        /// <param name="request">Segment data.</param>
        /// <returns>Success status.</returns>
        [HttpPost("Segments")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [Consumes(MediaTypeNames.Application.Json)]
        public ActionResult AddSegment([FromBody] SegmentDto request)
        {
            // Simple validation
            if (request.Start >= request.End)
            {
                _logger.LogWarning("[Parental Skipper] Invalid segment: Start {Start} >= End {End}", request.Start, request.End);
                return BadRequest("Start time must be less than End time.");
            }

            using var db = new Data.ParentalSkipperDbContext(Plugin.Instance.DbPath);
            var segment = new Segment
            {
                ItemId = request.ItemId,
                Start = request.Start,
                End = request.End,
                Reason = request.Reason ?? string.Empty
            };
            db.Segments.Add(segment);
            db.SaveChanges();
            
            _logger.LogInformation("[Parental Skipper] Added segment for item {ItemId}: {Start}s - {End}s (Reason: {Reason})", 
                request.ItemId, request.Start, request.End, request.Reason ?? "none");
            
            return Ok();
        }

        /// <summary>
        /// Deletes a segment by ID.
        /// </summary>
        /// <param name="id">Segment ID.</param>
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        /// <returns>Success status.</returns>
        [HttpDelete("Segments/{id}")]
        public ActionResult DeleteSegment([FromRoute] int id)
        {
            using var db = new Data.ParentalSkipperDbContext(Plugin.Instance.DbPath);
            var segment = db.Segments.Find(id);
            if (segment == null)
            {
                _logger.LogWarning("[Parental Skipper] Segment {Id} not found for deletion", id);
                return NotFound();
            }
            
            _logger.LogInformation("[Parental Skipper] Deleted segment {Id} for item {ItemId}: {Start}s - {End}s", 
                segment.Id, segment.ItemId, segment.Start, segment.End);
            
            db.Segments.Remove(segment);
            db.SaveChanges();
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
