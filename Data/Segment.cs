using System;

namespace ParentalSkipper.Data
{
    public class Segment
    {
        public int Id { get; set; }
        public Guid ItemId { get; set; }
        public double Start { get; set; }
        public double End { get; set; }
        public string? Reason { get; set; }
    }
}
