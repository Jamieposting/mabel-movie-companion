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
