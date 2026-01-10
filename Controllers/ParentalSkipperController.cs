using System;
using System.Collections.Generic;
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
            var segments = Plugin.Instance.Repository.GetSegments(itemId);
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

            Plugin.Instance.Repository.AddSegment(request.ItemId, request.Start, request.End);
            return Ok();
        }

        [HttpDelete("Segments/{id}")]
        public ActionResult DeleteSegment([FromRoute] int id)
        {
            Plugin.Instance.Repository.DeleteSegment(id);
            return Ok();
        }
    }

    public class SegmentDto
    {
        public Guid ItemId { get; set; }
        public double Start { get; set; }
        public double End { get; set; }
    }
}
