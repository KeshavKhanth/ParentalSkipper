using MediaBrowser.Model.Plugins;

namespace ParentalSkipper.Configuration
{
    public class PluginConfiguration : BasePluginConfiguration
    {
        // Global switch to enable the feature
        public bool IsEnabled { get; set; } = true;

        // Option to hide or show skip notification
        public bool ShowSkipNotification { get; set; } = true;
    }
}
