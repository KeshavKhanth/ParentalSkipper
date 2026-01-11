# Parental Skipper - AI Coding Agent Instructions

## Project Overview
**Parental Skipper** is a Jellyfin plugin (v10.8+) that automatically skips user-defined time segments during media playback. Built with .NET 6.0 and Entity Framework Core with SQLite for persistence.

## Architecture

### Core Components
- **[Plugin.cs](../Plugin.cs)**: Entry point, initializes SQLite DB at `{DataPath}/parentalskipper/parental_skipper.db`, exposes embedded config page
- **[Controllers/ParentalSkipperController.cs](../Controllers/ParentalSkipperController.cs)**: REST API (`/ParentalSkipper/*`) for CRUD operations on segments and serving client script
- **[Data/ParentalSkipperDbContext.cs](../Data/ParentalSkipperDbContext.cs)**: EF Core DbContext with `Segments` table indexed on `ItemId` (Jellyfin media GUID)
- **[Data/Segment.cs](../Data/Segment.cs)**: Model with `ItemId` (Guid), `Start`/`End` (double, seconds), `Reason` (string)
- **[Client/parental-skipper.js](../Client/parental-skipper.js)**: Browser-side player hijacking script injected via `/ParentalSkipper/ClientScript` endpoint
- **[Configuration/configPage.html](../Configuration/configPage.html)**: Dashboard UI (560 lines) with live search, series/season/episode dropdowns, HH:MM:SS time inputs

### Data Flow
1. Dashboard → API → SQLite (segment CRUD operations)
2. Playback Start → Client script fetches segments by `ItemId` → Monitors `video.timeupdate` → Seeks past segments

## Development Workflows

### Building & Publishing
```bash
# Local build
dotnet build ParentalSkipper.csproj --configuration Release

# Create release DLL
dotnet publish ParentalSkipper.csproj --configuration Release --output ./publish

# Calculate MD5 for manifest
md5sum publish/ParentalSkipper.dll | awk '{print $1}'
```

### Release Process
1. **Create Git Tag**: `git tag v1.0.x` → triggers [.github/workflows/build.yml](../.github/workflows/build.yml)
2. **CI Builds**: Publishes DLL to GitHub Release
3. **Manifest Update**: [.github/workflows/update-manifest.yml](../.github/workflows/update-manifest.yml) downloads DLL, calculates checksum, updates [manifest.json](../manifest.json)
4. **Version Sync**: Update `<Version>` in [ParentalSkipper.csproj](../ParentalSkipper.csproj) to match tag (e.g., `1.0.2.0` for `v1.0.2`)

### Testing Installation
Place `ParentalSkipper.dll` in Jellyfin's plugins directory:
- Linux: `/var/lib/jellyfin/plugins/Parental Skipper/`
- Windows: `%AppData%\Jellyfin\Server\plugins\Parental Skipper\`
- Docker: `/config/plugins/Parental Skipper/`

Restart Jellyfin and verify in Dashboard → Plugins.

## Critical Patterns

### Jellyfin Plugin Conventions
- **Embedded Resources**: `<EmbeddedResource Include="...">` in `.csproj` + access via `Assembly.GetManifestResourceStream()`
- **Dependency Handling**: ALL Jellyfin/EF packages use `<PrivateAssets>all</PrivateAssets>` (provided by host, not copied to output)
- **Plugin GUID**: `a741481e-3151-4ad9-968b-577317731032` is immutable across versions
- **Singleton Pattern**: `Plugin.Instance` provides global access to `DbPath`

### Time Format Handling
- **Storage**: Seconds as `double` (e.g., 930.5 = 15:30.5)
- **UI/API**: HH:MM:SS strings (configPage.html has `timeToSeconds()`/`secondsToTime()` converters)
- **Validation**: Start < End enforced in controller, UI validates format before submission

### Client Script Injection
Plugin serves script at `/ParentalSkipper/ClientScript` but does NOT auto-inject. Users must either:
1. Install [File Transformation Plugin](https://github.com/IAmParadox27/jellyfin-plugin-file-transformation) for automation
2. Manually add `<script src="/ParentalSkipper/ClientScript"></script>` to Jellyfin web's `index.html`

### Database Lifecycle
- **Initialization**: `Database.EnsureCreated()` in `Plugin` constructor (safe, creates if missing)
- **Connection Pattern**: `using var db = new ParentalSkipperDbContext(path)` for each request (no connection pooling)
- **Migrations**: Not used (schema frozen, EnsureCreated sufficient)

## Common Tasks

### Adding API Endpoints
Add methods to `ParentalSkipperController` with `[HttpGet/Post/Delete]` + route. Example:
```csharp
[HttpGet("Stats")]
public ActionResult<int> GetTotalSegments()
{
    using var db = new Data.ParentalSkipperDbContext(Plugin.Instance.DbPath);
    return Ok(db.Segments.Count());
}
```

### Modifying Schema
1. Update `Segment.cs` model
2. Update `OnModelCreating()` in `ParentalSkipperDbContext.cs`
3. **Warning**: No migration strategy exists; breaking changes require user DB deletion

### UI Changes
Edit [Configuration/configPage.html](../Configuration/configPage.html). Uses Jellyfin's Emby UI components:
- `<input is="emby-input">`, `<button is="emby-button">`, `<select is="emby-select">`
- API calls via `window.ApiClient.getUrl()` + `ApiClient.fetch()`
- Search uses `ApiClient.getItems()` with `SearchTerm`, `IncludeItemTypes`, `Recursive`

### Manifest Updates
For new releases, [manifest.json](../manifest.json) requires:
- `version`: Semantic version + `.0` suffix (e.g., `1.0.2.0`)
- `changelog`: Link to GitHub release tag
- `sourceUrl`: Direct DLL download URL
- `checksum`: MD5 of DLL
- `timestamp`: ISO 8601 UTC

Keep versions array sorted newest-first (Jellyfin convention).
Never add new .md file for summaration of changes

## Integration Points

### Jellyfin APIs Used
- `IApplicationPaths.DataPath`: Plugin data directory
- `IXmlSerializer`: Configuration persistence
- `ILogger<Plugin>`: Structured logging
- `ApiClient.getItems()`: Media library search (client-side)
- `ApiClient.getCurrentUserId()`: User context (client-side)

### External Dependencies
- **Entity Framework Core 6.0**: SQLite provider
- **ASP.NET Core**: Web API framework (provided by Jellyfin)
- **Jellyfin.Model/Controller 10.8.13**: Plugin framework

## Gotchas & Known Issues

1. **Client Script Loading**: Script may load before Jellyfin's `ApiClient` is ready; uses polling + retry logic
2. **ItemId Detection**: Client script parses URL hash for `id=` parameter (fragile, no robust playback API integration)
3. **Version Mismatch**: .csproj `<Version>` must manually match Git tags; no automated sync
4. **Seek Precision**: 1-second cooldown (`isSkipping` flag) prevents stutter after segment skip
5. **Series Complexity**: configPage.html has nested dropdowns (Series → Season → Episode) with 560 lines of imperative JS

## Next Steps for AI Agents

- When adding features, follow the `SegmentDto` pattern for API contracts
- Use `Plugin.Instance._logger?.LogInformation()` for debugging (nullable to prevent crashes)
- Test client script changes by opening browser DevTools → Network → check `/ParentalSkipper/ClientScript` loads
- For schema changes, discuss migration strategy first (currently breaks existing DBs)
