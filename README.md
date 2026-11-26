# Mabel Movie Companion

Watch a video alongside the ChatGPT conversation you already use. The player follows media time and supplies completed dialogue when the conversation asks for a scene. It supports YouTube, local and direct media files, and a manually aligned clock for another screen.

Derived from [Watch with Codex](https://github.com/miuuyy/watch-with-codex) at commit `f490044a06ed0cc133648e02ba99210d3f0c7ae2`. Copyright © 2026 Watch with Codex contributors. See the [MIT licence](LICENSE) and [original README](UPSTREAM-README.md).

## Run the player locally

Use Node.js 24 and npm. From the repository root, run:

```sh
cp .openai/hosting.example.json .openai/hosting.json
npm ci
npm test
npm run typecheck
npm run dev
```

Open the loopback address printed by the development server. Choose **Watch on another screen**, then **Try sample subtitles**. Seek to three seconds for one completed cue, twelve seconds for two, then back to three for one. You can also import the synthetic fixture in `tests/practice.srt`. Run `npm run build` to build the production Worker and client assets.

## Test the draft on Android Chrome over USB

This tests the branch on a physical tablet without publishing a Site. On a computer with Git, Node 24, npm and Android SDK Platform-Tools, run:

```sh
git clone --branch feature/multimodal-scene-awareness https://github.com/Jamieposting/mabel-movie-companion.git mabel-android-test
cd mabel-android-test
cp .openai/hosting.example.json .openai/hosting.json
npm ci
npm run dev -- --port 4173
```

Leave that terminal running. Enable USB debugging on the tablet, connect it by USB, unlock it and approve the computer. In a second terminal run `adb devices` (the tablet should say `device`), then `adb reverse tcp:4173 tcp:4173`. Open **http://127.0.0.1:4173/?watch=cLHTe_ORjLc** in Chrome on the tablet. Repeat with **http://127.0.0.1:4173/?watch=M7lc1UVf-VE**, Google's IFrame API sample video.

1. Tap Play **inside YouTube**. Before seeking, check for moving footage and watch both the YouTube elapsed time and Scene companion clock advance several seconds. A title, duration or changing YouTube subtitle alone does not confirm playback.
2. For Professor Dave, load the existing matching vidIQ JSON if the private hosted cache is unavailable locally. Pause after a completed line. Compare the two clocks, seek to 00:00:22, then rewind. Once settled, the scene should contain only completed lines at each new position. During buffering the companion can report an unavailable clock.
3. With frame sharing enabled, inspect **Browser frame checkpoint**. This checks the tablet UI and clock. A checkpoint alone contains no image. Verifying delivery also requires a host with screenshot access to that same tab and a successful pair of before/after checks. USB forwarding does not connect the cloud ChatGPT browser to the tablet. The hosted MCP dialogue relay requires the authenticated Site described below.

When finished, run `adb reverse --remove tcp:4173`, stop the server with Ctrl+C, and disable USB debugging if you enabled it for this test.

## Connect the hosted companion

1. Create your own authenticated OpenAI Site with Worker hosting. Put its assigned `project_id` in your local `.openai/hosting.json`, keeping the template's `r2` binding (`BUCKET`) and `mcp` capability. The local config is ignored by Git. Deploy the build with that config using the Sites publishing workflow.
2. Connect the resulting Site plugin and vidIQ in the ChatGPT account you watch with. The Site exposes JSON-RPC at `/mcp`. Its relay and cache depend on the trusted site-scoped viewer identity supplied by Sites and the private R2 binding. Running the local UI alone exercises the timeline and subtitle import.
3. In a chat host that exposes both plugins and supports programmatic tool chaining, ask the existing conversation to prepare a YouTube URL. Open the returned watch link. Select a commentary mode, tap **Share live scene**, and keep the signed-in player visible while asking about the video. Android split-screen can keep both the chat and player on screen.

### YouTube transcript handoff

The ChatGPT host coordinates the two plugins. The Site itself does not invoke vidIQ. Start with `prepare_youtube_watch(videoId)`. A cache hit returns the watch link. On `in_progress`, wait for the existing request. Only `extract_once` authorises the host to make one five-credit `vidiq_video_transcript` call for this workflow. Pass the returned video ID, language, and complete transcription with the reservation to `store_youtube_transcript` programmatically. Keep the transcript out of the model's conversation context.

Hosts differ in their ability to discover new tools and transfer results without exposing the raw content. If that capability is missing, import a previously obtained vidIQ JSON file through **Subtitle or vidIQ file**. Use the matching video ID and the provider's `transcription` and `language` fields. The player confirms whether the captions were cached or only loaded for the current visit. SRT and WebVTT import also work independently. The legacy standalone extractor is separate from the vidIQ route.

### Timing, sharing and storage

- The page samples the actual player clock for embedded YouTube and direct media. Pauses, seeks and playback speed changes therefore use media time. For **Watch on another screen**, mirror external pauses and seeks on the manual clock.
- SRT and WebVTT cues become eligible at their adjusted end time. vidIQ supplies start times, so a multiline block becomes eligible at the next timestamp. The final block requires a known video end. A fresh scene read after rewinding excludes later dialogue. Earlier messages already delivered to the chat remain in its history.
- The player answers `read_live_scene` only while sharing is enabled and the page is responsive. Each response includes at most 48 completed cues, the position and commentary guidance. Quiet mode supports questions. Other modes signal opportunities to a watching host. The Site cannot initiate messages in an idle chat.
- The R2 cache holds full vidIQ transcripts under the signed-in viewer and video ID. A short-lived reservation suppresses concurrent extractions. Live scene requests use a separate temporary slot. Local video and manually imported SRT/VTT stay in the browser, apart from the completed excerpt the viewer shares. Deploy behind an identity-aware gateway that sets the trusted identity header itself.

The automated suite uses synthetic dialogue and an in-memory cache. It covers caption boundaries, rewind, relay freshness, concurrent reservations and per-viewer isolation without contacting vidIQ or consuming credits. Live plugin discovery, cross-plugin orchestration and account permissions must be checked in the target ChatGPT host.

## Experimental player-frame observation

Frame capture adapts the paired observer in [cam-d3v/watch-with-codex](https://github.com/cam-d3v/watch-with-codex/tree/b00c4ca7c257478882bebc88c13902a2efde0d16). See its MIT-licensed player source and architecture. This option runs in a host with browser access to the player tab. No additional model subscription or API key is required.

1. Open the video and load captions as above. Select **Share player frames with this browser companion (experimental)**. Bring the entire player into view.
2. For browser hosts without WebMCP, expand **Browser frame checkpoint**, then scroll the player fully into view. The panel exposes the media time, completed dialogue, crop and session information. It is updated by the open page.
3. Ask the companion in the same conversation to look at the current frame. A programmatic browser host can use the adapter below. Its screenshot API must accept **viewport CSS pixel** clips; translate units for a different browser API. Never substitute a whole-page capture. A hidden player, changed layout, suspended tab, permission change, stale result or missing clock can yield dialogue only.
4. For continuous watching, choose **5, 10, 15 or 30 seconds**. In a WebMCP-enabled host, repeatedly request a scheduled observation while the viewer wants to watch. A question can request an immediate observation while paused. Stop the loop on pause, end, session change, cancellation or host interruption. Honour the scene's commentary mode even when a frame is available.

### Host setup

The exported adapter lives in `host/observe.mjs`. Use Node 24 or an equivalent host that supports importing the TypeScript validation helper. Supply the browser page and optionally a caller that returns the unwrapped JSON result from this tab's WebMCP tools. The host can use its own browser equivalent of the adapter when local imports are unavailable.

```js
import {observePlayer} from './host/observe.mjs';

const result = await observePlayer(page, {readTool, scheduled: false});
// Return result.scene and, when present, result.image to the same conversation.
// For an active watch loop, pass scheduled:true on each subsequent host call.
```

Each screenshot is bracketed by clock checks. The host returns the earlier dialogue cutoff, the bounded media-time range and transient image bytes. It rejects clock reversal, changed session/epoch, rate, status or crop, and a bracket wider than half a media second. A host must visually reject a black frame, spinner, poster, overlay or unrelated crop before describing it as footage. The screenshot API cannot prove that a cross-origin iframe decoded the requested frame. The app never writes frames to transcript storage. The receiving host or conversation may retain delivered messages and images.

| Surface | Evidence and limits |
| --- | --- |
| Desktop browser | The player exposes checkpoints. An ordinary standalone tab also needs a browser-capable host to perform a crop. |
| ChatGPT Work browser | A single browser operation in the existing conversation returned a visible speaker and elephants with the first completed line at 7.000 s in *Me at the zoo*, using the Wikimedia-hosted WebM copy of the YouTube video and its published English subtitles. The proof used the visible scene panel; this browser did not advertise WebMCP. |
| YouTube iframe | Two real embeds loaded in the Work browser. The test returned black pixels or a spinner; after one seek the displayed caption changed while the reported clock lagged. In a subsequent desktop Work test with video `cLHTe_ORjLc`, the real iframe loaded its title and 1:06:48 duration. After Play and a seek to 22 seconds, the scene checkpoint returned an unavailable time, zero completed cues and no frame. Absolute Seek and Play remained usable. A follow-up tested native Play before any seek on this video and Google’s reference video M7lc1UVf-VE. Both reported elapsed time 0, HTML media readyState 0 and videoWidth 0 after Play. A plain iframe containing the reference video, without React or the application’s IFrame API integration, reproduced the stall. No underlying delivery or decoder error was identified. A paired observation of decoded YouTube footage remains unverified. |
| Android | Existing dialogue relay remains available with the player visible. Player-only screenshots and sustained observation have not been verified on a physical device. |
| Ordinary ChatGPT conversation | The existing authenticated MCP tool returns a fresh text scene. No automatic screenshot path was demonstrated for a host without a browser handle. |
| ChatGPT Voice | Device screen sharing, where available, is a separate user-controlled feature. Synchronisation with these checkpoints and automatic Voice observations remain unverified. |

**Alternatives evaluated.** Browser screen capture through `getDisplayMedia()` needs a viewer gesture, a browser permission prompt and a selected capture surface. A whole display may include other apps and offers no inherent proof that the captured surface is the active player. MCP supports image content blocks, but an image response still needs an authorised and verifiable pixel source and a host that consumes it. Neither alternative is enabled in the existing R2 text relay. Protected media and unavailable frames fall back to dialogue.

References: [film and licence](https://commons.wikimedia.org/wiki/File:Me_at_the_zoo.webm), [English timing](https://commons.wikimedia.org/wiki/TimedText:Me_at_the_zoo.webm.en.srt), [browser screen capture](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getDisplayMedia), [MCP tools](https://modelcontextprotocol.io/specification/2025-06-18/server/tools), [ChatGPT Voice](https://help.openai.com/en/articles/8400625-voice-mode-faq).

### Private Android preview · paused YouTube frame

Android playback and the media clock have been verified by the viewer. The existing live-scene tool returns text. A browser host can screenshot its own tab; it cannot use that capability on a separate Android Chrome tab. The YouTube IFrame API exposes time and playback controls but offers no current-frame pixel method. Chrome Android lacks supported tab capture with getDisplayMedia. An extension requires a compatible host and installation. The existing 5/10/15/30-second host observation loop is independent of the Android procedure.

1. Play the video, pause on a distinctive image and wait for Mabel's clock to settle. Leave fullscreen. Enable experimental frame sharing and tap **Mark paused player**.
2. With both colour strips visible, take an Android screenshot (Power and Volume Down together). Choose that screenshot in the player. The page checks both random strips and player dimensions, discards the rest of the screen locally and shows the proposed crop. Reject a black picture, overlay or sensitive content. The Android screenshot itself may remain in your device Gallery.
3. Tap **Approve this crop for Mabel**. Keep Chrome visible in Android split-screen with ChatGPT. Within 90 seconds of marking, ask your existing chat to use **Mabel Movie Android Preview → observe_current_frame** and describe a distinctive detail. No transcript or vidIQ call is required. A fresh request returns a JPEG image block and the scene at the marked pause, including completed dialogue, rate and commentary mode. One approval serves one request. A rewind, resume, changed clock, speed, session or expired mark requires a new capture.
4. **Stop and discard crop** clears the local selection. Only the approved crop is encrypted for the waiting MCP call and uploaded to the authenticated viewer's frame ticket. A private request key exists only in that invocation's memory. The relay attempts to replace the response with a short-lived retrieval acknowledgement; expiry prevents later reads. The device and the receiving chat have their own retention behaviour.
5. To test host compatibility separately, ask the preview's **test_frame_delivery** tool for the characters in its synthetic test picture. Count this as host support only if the actual image reaches the chat and the answer matches. A server retrieval acknowledgement alone cannot confirm host rendering or interpretation. A missing tool can indicate a stale host tool list. An image-free result cannot establish visual context.

The device supplies neither a trusted shutter timestamp nor API access to its screen. The tool reports the marked media timestamp and an upper bound on image age (the window from marking to file selection). It returns a viewer-approved paused observation; automated capture of a moving YouTube iframe on this tablet is unavailable. If a host strips image blocks, the installation-free alternative is to attach the reviewed player-only screenshot directly to the same chat. For automatic capture a separate supported, user-authorised capture source is required, such as an installed Android app using MediaProjection. Protected content may remain black.

References: [Chrome Android screen-capture compatibility](https://web-platform-dx.github.io/web-features-explorer/features/screen-capture/), [YouTube IFrame API](https://developers.google.com/youtube/iframe_api_reference), [Android screenshots](https://support.google.com/android/answer/9075928), [Android MediaProjection](https://developer.android.com/media/grow/media-projection), [MCP image content](https://modelcontextprotocol.io/specification/2025-11-25/server/tools).

The preview MCP can also service an image request via `read_live_scene({observation:"frame"})` in hosts with an older tool list. Before releasing the crop the server asks the visible player to reconfirm the same paused session. A blind PNG test in ChatGPT Work returned an actual image block and readable characters. The current transport test exercises the JPEG encryption and decoding path. Physical Android capture remains a separate acceptance test.
