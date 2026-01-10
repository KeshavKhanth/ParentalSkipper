using System;
using System.Collections.Generic;
using System.Linq;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using ParentalSkipper.Data;
using System.Net.Mime;

namespace ParentalSkipper.Controllers
{
    [ApiController]
    [Route("ParentalSkipper")]
    [Authorize]
    public class ParentalSkipperController : ControllerBase
    {
        [HttpGet("ClientScript")]
        [AllowAnonymous]
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

        [HttpGet("Segments/{itemId}")]
        public ActionResult<List<Segment>> GetSegments([FromRoute] Guid itemId)
        {
            using var db = new Data.ParentalSkipperDbContext(Plugin.Instance.DbPath);
            var segments = db.Segments.Where(s => s.ItemId == itemId).ToList();
            return Ok(segments);
        }

        [HttpPost("Segments")]
        public ActionResult AddSegment([FromBody] SegmentDto request)
        {
            // Simple validation
            if (request.Start >= request.End)
            {
                return BadRequest("Start time must be less than End time.");
            }

            using var db = new Data.ParentalSkipperDbContext(Plugin.Instance.DbPath);
            db.Segments.Add(new Segment
            {
                ItemId = request.ItemId,
                Start = request.Start,
                End = request.End,
                Reason = request.Reason ?? string.Empty
            });
            db.SaveChanges();
            return Ok();
        }

        [HttpDelete("Segments/{id}")]
        public ActionResult DeleteSegment([FromRoute] int id)
        {
            using var db = new Data.ParentalSkipperDbContext(Plugin.Instance.DbPath);
            var segment = db.Segments.Find(id);
            if (segment == null)
                return NotFound();
            
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
        public string Reason { get; set; }
    }
}
