using MediaBrowser.Controller;
using MediaBrowser.Controller.MediaSegments;
using MediaBrowser.Controller.Plugins;
using Microsoft.Extensions.DependencyInjection;
using ParentalSkipper.Manager;
using ParentalSkipper.Providers;
using ParentalSkipper.Services;

namespace ParentalSkipper
{
    /// <summary>
    /// Registers Parental Skipper services with the Jellyfin DI container.
    /// </summary>
    public class PluginServiceRegistrator : IPluginServiceRegistrator
    {
        /// <inheritdoc />
        public void RegisterServices(IServiceCollection serviceCollection, IServerApplicationHost applicationHost)
        {
            // Register the hosted service for script injection (web client fallback)
            serviceCollection.AddHostedService<Entrypoint>();
            
            // Register the media segment provider for native Jellyfin skip button
            serviceCollection.AddSingleton<IMediaSegmentProvider, SegmentProvider>();
            
            // Register the segment update manager (transient for per-request usage)
            serviceCollection.AddTransient<MediaSegmentUpdateManager>();
        }
    }
}
