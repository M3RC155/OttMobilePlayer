# OTT Mobile Player

A cross-platform mobile application built with React Native and Expo, designed to parse, store, and stream media content from large M3U/M3U8 playlists without compromising UI performance.

## Features

- **Playlist Input:** Users can input a remote `.m3u` or `.m3u8` playlist URL.
- **Background Parsing:** Massive playlists (50MB+) are parsed in the background without blocking the main UI thread.
- **Local Storage:** Parsed channels, categories, and stream URLs are efficiently stored in a local SQLite database (`expo-sqlite`).
- **High-Performance UI:** Channels are fetched using pagination/lazy-loading to keep the interface smooth and responsive, even during background parsing.
- **Media Playback:** Built-in video player supports native HLS and MPEG-TS video streams using modern media libraries (`expo-video` / `react-native-vlc-media-player`).
- **Standard Controls:** Includes Play/Pause, Seek, Fullscreen toggle, and error handling for robust streaming.

## Prerequisites

- Node.js (v18+ recommended)
- npm or yarn
- [Expo CLI](https://docs.expo.dev/get-started/installation/)
- iOS Simulator (for Mac) or Android Emulator (for Windows/Mac), or a physical device with the Expo Go app installed.

## Installation

1. Clone this repository (or navigate to the project directory).
2. Install the dependencies:
   ```bash
   npm install
   ```

## Running the Application

To start the Expo development server, run:

```bash
npm start
```

This will open the Expo Developer Tools in your terminal. From there, you can:
- Press `a` to run on an Android Emulator.
- Press `i` to run on an iOS Simulator.
- Scan the QR code with your mobile device using the Expo Go app (Android) or the native Camera app (iOS) to test on a physical device.

**Note:** For optimal performance testing and native media playback support (especially for custom codecs like MPEG-TS), running a prebuild or development build (`expo run:android` / `expo run:ios`) on a real device is highly recommended over Expo Go.

## Testing the Application

### 1. Playlist Loading & Parsing
- Launch the app and navigate to the Home screen.
- Enter a valid M3U/M3U8 playlist URL. (You can use public playlists from [iptv-org/iptv](https://github.com/iptv-org/iptv) for testing).
- Submit the URL and observe the UI. The app should remain fully responsive while the playlist is downloaded and parsed in the background.

### 2. UI Performance & Lazy Loading
- Navigate to the Channels list screen.
- Scroll rapidly through the list of channels.
- Verify that the app loads chunks of channels dynamically (pagination) from the local SQLite database without stuttering.

### 3. Media Playback
- Tap on any channel from the list to enter the Player screen.
- Ensure the video stream loads and plays successfully.
- Test the player controls:
  - Play / Pause
  - Enter / Exit Fullscreen mode
- To test error handling, try playing an invalid URL or turning off your internet connection during playback; the app should display an appropriate error message and gracefully recover without crashing.

## Architecture Highlights

- **Database:** `db.ts` handles the initialization and interactions with the SQLite database, ensuring fast inserts and paginated reads.
- **Parser:** `parser.ts` handles streaming line-by-line parsing of M3U files, avoiding loading massive strings into memory simultaneously.
- **Navigation:** Handled via `@react-navigation/native-stack` for seamless transitions between Home, Channel List, and Player screens.
