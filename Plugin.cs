using System;
using System.Collections.Generic;
using MediaBrowser.Common.Configuration;
using MediaBrowser.Common.Plugins;
using MediaBrowser.Model.Plugins;
using MediaBrowser.Model.Serialization;
using ParentalSkipper.Configuration;

namespace ParentalSkipper
{
    public class Plugin : BasePlugin<PluginConfiguration>, IHasWebPages
    {
        public static Plugin Instance { get; private set; }

        private readonly string _dbPath;
        public Data.SkipperRepository Repository { get; private set; }

        public Plugin(IApplicationPaths applicationPaths, IXmlSerializer xmlSerializer)
            : base(applicationPaths, xmlSerializer)
        {
            Instance = this;
            _dbPath = System.IO.Path.Combine(applicationPaths.DataPath, "parental_skipper.db");
            Repository = new Data.SkipperRepository(_dbPath);
        }

        public override string Name => "Parental Skipper";

        public override Guid Id => Guid.Parse("a741481e-3151-4ad9-968b-577317731032");

        public override string Description => "Skip manually defined scenes for content moderation.";

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
