# Installation Guide

## Quick Installation (Recommended)

### Add as Plugin Repository

1. Open your Jellyfin Dashboard
2. Navigate to **Plugins** → **Repositories**
3. Click the **+** button to add a new repository
4. Enter the following details:
   - **Repository Name**: `Parental Skipper`
   - **Repository URL**: 
     ```
     https://raw.githubusercontent.com/KeshavKhanth/ParentalSkipper/main/manifest.json
     ```
5. Click **Save**
6. Go to **Plugins** → **Catalog**
7. Find **Parental Skipper** in the list
8. Click **Install**
9. Restart your Jellyfin server

## Manual Installation

### Download and Install

1. Download the latest `ParentalSkipper.dll` from the [Releases page](https://github.com/KeshavKhanth/ParentalSkipper/releases)

2. Create the plugin directory if it doesn't exist:
   - **Linux**: `/var/lib/jellyfin/plugins/Parental Skipper/`
   - **Windows**: `%AppData%\Jellyfin\Server\plugins\Parental Skipper\`
   - **Docker**: `/config/plugins/Parental Skipper/`

3. Copy `ParentalSkipper.dll` to the plugin directory

4. Restart Jellyfin

### Verify Installation

1. Go to **Dashboard** → **Plugins** → **My Plugins**
2. Confirm "Parental Skipper" appears in the list with version 1.0.0.0
3. You should see the plugin configuration page

## Usage

### Configure Skip Segments

1. Go to **Dashboard** → **Plugins** → **Parental Skipper**
2. Search for a movie or TV episode
3. Click on the item to select it
4. Add time segments (in seconds) that should be skipped
5. Click **Add** to save each segment
6. The segments will be automatically skipped during playback when enabled

### Enable Auto-Skip

The plugin automatically enables scene skipping. When you play a video that has defined skip segments, they will be automatically skipped.

## Requirements

- **Jellyfin Version**: 10.8.0 or higher
- **Platform**: Any platform that supports Jellyfin
- **.NET Runtime**: 6.0 (included with Jellyfin)

## Troubleshooting

### Plugin doesn't appear in catalog
- Make sure you entered the repository URL correctly
- Check that your Jellyfin server has internet access
- Try refreshing the plugin catalog

### Scenes aren't being skipped
- Verify that you've added skip segments for the specific movie/episode
- Check that the segments are saved correctly in the plugin dashboard
- Ensure you're using the Jellyfin web client (third-party clients may not support this feature yet)

### Cannot access plugin configuration
- Make sure the plugin is installed and enabled
- Restart Jellyfin after installation
- Check Jellyfin logs for any errors

## Support

For issues, questions, or feature requests:
- [Open an issue](https://github.com/KeshavKhanth/ParentalSkipper/issues)
- Check existing issues for solutions

## Updating

When using the plugin repository method, updates will appear in:
**Dashboard** → **Plugins** → **Catalog** → **Updates Available**

For manual installation, download the new version and replace the DLL file, then restart Jellyfin.
