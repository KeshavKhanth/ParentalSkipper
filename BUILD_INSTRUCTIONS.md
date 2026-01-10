# Build Instructions

Since you are new to C#, the easiest way to get the plugin file (`.dll`) is to let GitHub build it for you.

## Option 1: Automatic Build (Recommended)
1.  Push this code to your GitHub repository.
2.  Go to the **Actions** tab in your repository.
3.  Click on the latest workflow run (it should be named "Build Plugin").
4.  Scroll down to the **Artifacts** section.
5.  Download **ParentalSkipper-Plugin**.
6.  Extract the zip file. You will find `ParentalSkipper.dll`.

## Option 2: Manual Build
If you want to build it on your own computer:

1.  **Install the .NET SDK**:
    -   Download and install the **.NET 6.0 SDK** from [https://dotnet.microsoft.com/download/dotnet/6.0](https://dotnet.microsoft.com/download/dotnet/6.0).

2.  **Open a Terminal/Command Prompt**:
    -   Navigate to the folder where you downloaded this code.

3.  **Run the Build Command**:
    ```bash
    dotnet publish ParentalSkipper/ParentalSkipper.csproj --configuration Release --output ./bin/Release/publish
    ```

4.  **Find the DLL**:
    -   Go to the folder `bin/Release/publish`.
    -   Copy `ParentalSkipper.dll` to your Jellyfin `plugins` folder.
    -   Restart Jellyfin.

## Installation in Jellyfin
1.  Place `ParentalSkipper.dll` in your Jellyfin plugins folder (usually `/var/lib/jellyfin/plugins/ParentalSkipper` or `C:\ProgramData\Jellyfin\Server\plugins\ParentalSkipper`).
2.  Restart the Jellyfin server.
3.  Go to **Dashboard > Plugins**. You should see "Parental Skipper".
4.  Click on it to configure settings.
5.  **Important:** Follow the instructions on the configuration page to inject the client-side script.
