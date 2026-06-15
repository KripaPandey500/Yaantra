using Microsoft.OpenApi.Models;
using Swashbuckle.AspNetCore.SwaggerGen;
using System.Linq;
using Microsoft.AspNetCore.Http;

namespace WeatherAPI.Filters
{
    public class FileUploadOperationFilter : IOperationFilter
    {
        public void Apply(OpenApiOperation operation, OperationFilterContext context)
        {
            var hasFileUpload = context.MethodInfo.GetParameters()
                .Any(p => p.ParameterType == typeof(IFormFile) ||
                          (p.ParameterType.IsClass && p.ParameterType.GetProperties().Any(prop => prop.PropertyType == typeof(IFormFile))));

            if (!hasFileUpload)
                return;

            // Safely handle empty or null operation.Parameters
            var properties = new Dictionary<string, OpenApiSchema>();
            if (operation.Parameters != null && operation.Parameters.Count > 0)
            {
                foreach (var p in operation.Parameters)
                {
                    var isFile = p.Name.ToLower().Contains("file") || p.Name.ToLower().Contains("picture");
                    properties[p.Name] = new OpenApiSchema { Type = "string", Format = isFile ? "binary" : null };
                }
            }

            operation.RequestBody = new OpenApiRequestBody
            {
                Content =
                {
                    ["multipart/form-data"] = new OpenApiMediaType
                    {
                        Schema = new OpenApiSchema
                        {
                            Type = "object",
                            Properties = properties,
                            Required = operation.Parameters != null ? operation.Parameters.Where(p => p.Required).Select(p => p.Name).ToHashSet() : new HashSet<string>()
                        }
                    }
                }
            };
            operation.Parameters?.Clear();
        }
    }
}
