using System;
using System.Collections.Generic;
using System.IO;
using MediaBrowser.Common.Configuration;
using MediaBrowser.Common.Plugins;
using MediaBrowser.Model.Plugins;
using MediaBrowser.Model.Serialization;
using Microsoft.Extensions.Logging;
using ParentalSkipper.Configuration;

namespace ParentalSkipper
{
    /// <summary>
    /// Parental Skipper plugin for Jellyfin.
    /// Allows skipping manually defined scenes for content moderation.
    /// </summary>
    public class Plugin : BasePlugin<PluginConfiguration>, IHasWebPages
    {
        /// <summary>
        /// Gets the plugin instance.
        /// </summary>
        public static Plugin? Instance { get; private set; }

        private readonly string _dbPath;
        private readonly ILogger<Plugin> _logger;

        /// <summary>
        /// Gets the path to the plugin database.
        /// </summary>
        public string DbPath => _dbPath;

        /// <summary>
        /// Initializes a new instance of the <see cref="Plugin"/> class.
        /// </summary>
        /// <param name="applicationPaths">Application paths.</param>
        /// <param name="xmlSerializer">XML serializer.</param>
        /// <param name="logger">Logger instance.</param>
        public Plugin(
            IApplicationPaths applicationPaths,
            IXmlSerializer xmlSerializer,
            ILogger<Plugin> logger)
            : base(applicationPaths, xmlSerializer)
        {
            Instance = this;
            _logger = logger;

            // Create plugin directory if it doesn't exist
            var pluginDir = Path.Combine(applicationPaths.DataPath, "parentalskipper");
            if (!Directory.Exists(pluginDir))
            {
                Directory.CreateDirectory(pluginDir);
            }

            _dbPath = Path.Combine(pluginDir, "parental_skipper.db");

            // Initialize database safely
            try
            {
                using var db = new Data.ParentalSkipperDbContext(_dbPath);
                db.Initialize();
                _logger.LogInformation("[Parental Skipper] Database initialized at {DbPath}", _dbPath);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[Parental Skipper] Error initializing database");
            }
        }

        /// <inheritdoc />
        public override string Name => "Parental Skipper";

        /// <inheritdoc />
        public override Guid Id => Guid.Parse("a741481e-3151-4ad9-968b-577317731032");

        /// <inheritdoc />
        public override string Description => "Skip manually defined scenes for content moderation.";

        /// <inheritdoc />
        public IEnumerable<PluginPageInfo> GetPages()
        {
            return new[]
            {
                new PluginPageInfo
                {
                    Name = Name,
                    EnableInMainMenu = true,
                    EmbeddedResourcePath = GetType().Namespace + ".Configuration.configPage.html"
                }
            };
        }
    }
}

