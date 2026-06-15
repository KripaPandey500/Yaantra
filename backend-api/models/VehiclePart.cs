using System.ComponentModel.DataAnnotations;

namespace backend_api.models
{
    public class VehiclePart
    {
        [Key]
        public int Id { get; set; }

        [Required][MaxLength(200)]
        public string Name { get; set; }

        [Required][MaxLength(1000)]
        public string Description { get; set; }

        [Required]
        public decimal Price { get; set; }
    }
}