# Parental Skipper

<div align="center">
    <p>
        <b>A Jellyfin Plugin for Family-Friendly Content Viewing</b>
    </p>
    <p>
        Automatically skip inappropriate or awkward scenes in movies and TV shows, making them suitable for family viewing.
    </p>
</div>

---

## 📖 Overview

**Parental Skipper** is a Jellyfin plugin that helps you enjoy movies and TV shows with family and friends by automatically skipping scenes that might be uncomfortable or inappropriate. While many great films contain excellent content, some scenes can make them unsuitable for group viewing. This plugin solves that problem.

### How It Works

1. **Manual Scene Definition**: Define specific time ranges for scenes that should be skipped in the Jellyfin dashboard
2. **Automatic Skipping**: When enabled in the video player, the plugin automatically skips over predefined scenes
3. **Community Database (Planned)**: Future versions will include a community-driven database where users can contribute and share skip timestamps

## ✨ Features

- 🎬 **Manual Scene Management**: Define custom skip segments for any movie or TV show
- ⏭️ **Automatic Skipping**: Seamlessly skip predefined scenes during playback
- 🛠️ **Dashboard Configuration**: Easy-to-use interface for managing skip segments
- 📊 **Per-Media Configuration**: Set different skip segments for each movie or episode
- 🔄 **Future Ready**: Architecture designed for community database integration

## 🚀 Quick Start

### Installation

#### Method 1: Plugin Repository (Recommended)

1. **Add Plugin Repository** to your Jellyfin server:
   - Go to **Dashboard** → **Plugins** → **Repositories**
   - Click **+** to add a new repository
   - Enter the following details:
     - **Repository Name**: `Parental Skipper`
     - **Repository URL**: `https://raw.githubusercontent.com/KeshavKhanth/ParentalSkipper/main/manifest.json`
   - Click **Save**

2. **Install the Plugin**:
   - Navigate to **Dashboard** → **Plugins** → **Catalog**
   - Find **Parental Skipper** and click **Install**
   - Restart Jellyfin

#### Method 2: Manual Installation

1. Download the latest `ParentalSkipper.dll` from [Releases](https://github.com/KeshavKhanth/ParentalSkipper/releases)
2. Place it in your Jellyfin plugins directory:
   - **Linux**: `/var/lib/jellyfin/plugins/Parental Skipper/`
   - **Windows**: `%AppData%\Jellyfin\Server\plugins\Parental Skipper\`
   - **Docker**: `/config/plugins/Parental Skipper/`
3. Restart Jellyfin

### Basic Usage

1. **Configure Skip Segments**:
   - Navigate to **Dashboard** → **Parental Skipper**
   - Select a movie or TV show from your library
   - Add time ranges for scenes you want to skip
   - Save your configuration

2. **Enable During Playback**:
   - Start playing a video with configured skip segments
   - The plugin will automatically skip the defined scenes
   - (Optional) Manual skip button may be available depending on client

## 📋 System Requirements

- **Jellyfin**: Version 10.8.0 or newer
- **Operating System**: 
  - Linux (Debian, Ubuntu, Fedora, etc.)
  - Windows Server 2016+, Windows 10/11
  - macOS 10.14+
- **Storage**: Minimal (< 10MB for plugin + database)

## 🛠️ Configuration

### Adding Skip Segments

1. Access the **Parental Skipper** configuration page from the Jellyfin dashboard
2. Search or browse for the media item
3. Click "Add Segment"
4. Enter:
   - **Start Time** (format: HH:MM:SS or MM:SS)
   - **End Time** (format: HH:MM:SS or MM:SS)
   - **Reason** (optional description)
5. Save the segment

### Example Configuration

```
Movie: Example Movie (2024)
Segments:
  - Start: 00:15:30, End: 00:16:45, Reason: "Inappropriate scene"
  - Start: 01:23:00, End: 01:24:15, Reason: "Violence"
```

## 🗺️ Roadmap

- [x] Core plugin architecture
- [x] Manual segment definition
- [x] Automatic skipping during playback
- [x] Dashboard interface
- [ ] Community database integration
- [ ] User contribution system
- [ ] Scene rating/voting system
- [ ] Export/import skip profiles
- [ ] Multi-language support
- [ ] Mobile app integration

## 🤝 Contributing

We welcome contributions! Future versions will allow the community to:

- Submit skip timestamps for movies and TV shows
- Vote on existing timestamps for accuracy
- Share custom profiles for different content ratings
- Translate the plugin into other languages

### Development Setup

```bash
# Clone the repository
git clone https://github.com/yourusername/ParentalSkipper.git
cd ParentalSkipper

# Build the plugin
dotnet build

# Run tests (when available)
dotnet test
```

## 📖 Documentation

### Architecture

The plugin consists of:

- **Plugin.cs**: Main plugin entry point
- **Controllers/**: API endpoints for managing skip segments
- **Configuration/**: Dashboard UI and settings
- **Data/**: Database models and repository
- **Client/**: Client-side JavaScript for player integration

### Database Schema

Skip segments are stored in a SQLite database (`parental_skipper.db`) with the following structure:

```
Segments:
  - Id (GUID)
  - MediaItemId (GUID)
  - StartTime (seconds)
  - EndTime (seconds)
  - Reason (text, optional)
  - CreatedAt (timestamp)
```

## ⚠️ Limitations

- Manual segment definition required for each media item
- Skip functionality may vary by client (web, mobile, TV apps)
- Some clients may not support automatic skipping
- Synced playback (SyncPlay) may have limitations

## 🙏 Acknowledgments

This plugin was inspired by and references the excellent [Intro Skipper](https://github.com/intro-skipper/intro-skipper) plugin. Special thanks to:

- The Jellyfin team for the excellent media server platform
- The Intro Skipper project for architectural inspiration
- The Jellyfin plugin development community

## 📄 License

This project is licensed under the **GPL-3.0 License** - see the [LICENSE](LICENSE) file for details.

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/ParentalSkipper/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/ParentalSkipper/discussions)
- **Discord**: [Join our community] (link when available)

## 🔒 Privacy

Parental Skipper respects your privacy:

- All skip segments are stored locally on your Jellyfin server
- No data is sent to external servers (until community database feature is implemented)
- Future community features will be opt-in
- See [PRIVACY.md](PRIVACY.md) for complete privacy policy

---

<div align="center">
    <p>Made with ❤️ for families who love movies</p>
    <p>
        <a href="https://github.com/yourusername/ParentalSkipper">GitHub</a> •
        <a href="https://github.com/yourusername/ParentalSkipper/wiki">Wiki</a> •
        <a href="https://github.com/yourusername/ParentalSkipper/releases">Releases</a>
    </p>
</div>
