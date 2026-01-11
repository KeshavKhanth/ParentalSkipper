using System;
using System.Linq;
using System.Reflection;
using System.Runtime.Loader;
using System.Text.Json.Serialization;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Newtonsoft.Json.Linq;

namespace ParentalSkipper.Services
{
    /// <summary>
    /// Server entry point for Parental Skipper plugin.
    /// Registers with File Transformation Plugin to inject client script.
    /// </summary>
    public sealed class Entrypoint : IHostedService, IDisposable
    {
        private readonly ILogger<Entrypoint> _logger;

        /// <summary>
        /// Initializes a new instance of the <see cref="Entrypoint"/> class.
        /// </summary>
        /// <param name="logger">Logger instance.</param>
        public Entrypoint(ILogger<Entrypoint> logger)
        {
            _logger = logger;
        }

        /// <inheritdoc />
        public Task StartAsync(CancellationToken cancellationToken)
        {
            _logger.LogInformation("[Parental Skipper] Plugin entry point started.");

            // Register with File Transformation Plugin for script injection
            try
            {
                InitializeWebInjector();
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "[Parental Skipper] Failed to register with File Transformation Plugin. Please ensure it is installed.");
            }

            return Task.CompletedTask;
        }

        /// <inheritdoc />
        public Task StopAsync(CancellationToken cancellationToken)
        {
            _logger.LogInformation("[Parental Skipper] Plugin entry point stopped.");
            return Task.CompletedTask;
        }

        /// <summary>
        /// Initializes the web injector by registering with File Transformation Plugin.
        /// </summary>
        private void InitializeWebInjector()
        {
            // Find the File Transformation Plugin assembly
            Assembly? fileTransformationAssembly = AssemblyLoadContext.All
                .SelectMany(x => x.Assemblies)
                .FirstOrDefault(x => x.FullName?.Contains(".FileTransformation", StringComparison.Ordinal) ?? false);

            if (fileTransformationAssembly is null)
            {
                _logger.LogWarning("[Parental Skipper] File Transformation Plugin not found. Client script will not be injected automatically.");
                _logger.LogWarning("[Parental Skipper] Please install File Transformation Plugin from: https://github.com/IAmParadox27/jellyfin-plugin-file-transformation");
                return;
            }

            Type? pluginInterfaceType = fileTransformationAssembly.GetType("Jellyfin.Plugin.FileTransformation.PluginInterface");
            if (pluginInterfaceType is null)
            {
                _logger.LogWarning("[Parental Skipper] File Transformation Plugin interface not found.");
                return;
            }

            // Register transformation for index.html to inject our script
            var payload = new JObject
            {
                { "id", Plugin.Instance?.Id.ToString() ?? "a741481e-3151-4ad9-968b-577317731032" },
                { "fileNamePattern", "index.html" },
                { "callbackAssembly", GetType().Assembly.FullName },
                { "callbackClass", typeof(ScriptInjector).FullName },
                { "callbackMethod", nameof(ScriptInjector.InjectScript) }
            };

            var registerMethod = pluginInterfaceType.GetMethod("RegisterTransformation");
            if (registerMethod is null)
            {
                _logger.LogWarning("[Parental Skipper] RegisterTransformation method not found in File Transformation Plugin.");
                return;
            }

            registerMethod.Invoke(null, new object[] { payload });
            _logger.LogInformation("[Parental Skipper] Successfully registered with File Transformation Plugin for script injection.");
        }

        /// <inheritdoc />
        public void Dispose()
        {
            // Nothing to dispose
        }
    }

    /// <summary>
    /// Payload request class for File Transformation Plugin callback.
    /// </summary>
    public class PayloadRequest
    {
        /// <summary>
        /// Gets or sets the contents of the file to transform.
        /// </summary>
        [JsonPropertyName("contents")]
        public string? Contents { get; set; }
    }

    /// <summary>
    /// Static class for File Transformation Plugin callback.
    /// Injects the Parental Skipper client script into the Jellyfin web client.
    /// </summary>
    public static class ScriptInjector
    {
        private const string ScriptTag = "<script src=\"/ParentalSkipper/ClientScript\"></script>";
        private const string ScriptMarker = "<!-- Parental Skipper -->";
        private static readonly string LogFile = System.IO.Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "ParentalSkipper_injection.log");

        /// <summary>
        /// Callback method for File Transformation Plugin to inject the client script.
        /// This is called by the File Transformation Plugin when serving index.html.
        /// </summary>
        /// <param name="payload">The transformation payload containing file contents.</param>
        /// <returns>The modified file contents with injected script.</returns>
        public static string InjectScript(PayloadRequest payload)
        {
            try
            {
                System.IO.File.AppendAllText(LogFile, $"[{DateTime.Now}] InjectScript called\n");

                ArgumentNullException.ThrowIfNull(payload);

                string contents = payload.Contents ?? string.Empty;
                System.IO.File.AppendAllText(LogFile, $"[{DateTime.Now}] Contents length: {contents.Length}\n");

                if (string.IsNullOrEmpty(contents))
                {
                    System.IO.File.AppendAllText(LogFile, $"[{DateTime.Now}] Contents empty, returning\n");
                    return contents;
                }

                // Check if already injected
                if (contents.Contains("/ParentalSkipper/ClientScript"))
                {
                    System.IO.File.AppendAllText(LogFile, $"[{DateTime.Now}] Script already injected\n");
                    return contents;
                }

                // Find </body> tag and inject before it
                var bodyEndIndex = contents.LastIndexOf("</body>", StringComparison.OrdinalIgnoreCase);
                if (bodyEndIndex == -1)
                {
                    System.IO.File.AppendAllText(LogFile, $"[{DateTime.Now}] No </body> tag found\n");
                    return contents;
                }

                var fullScriptTag = $"{ScriptMarker}\n    {ScriptTag}";
                var result = contents.Insert(bodyEndIndex, $"{fullScriptTag}\n    ");
                System.IO.File.AppendAllText(LogFile, $"[{DateTime.Now}] Script injected successfully, new length: {result.Length}\n");
                return result;
            }
            catch (Exception ex)
            {
                try
                {
                    System.IO.File.AppendAllText(LogFile, $"[{DateTime.Now}] ERROR: {ex.Message}\n{ex.StackTrace}\n");
                }
                catch { }
                throw;
            }
        }
    }
}
