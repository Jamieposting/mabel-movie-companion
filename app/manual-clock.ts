// The browser may throttle renders in background tabs. Sample a monotonic clock on every read.
export function manualClock(now = () => performance.now()) {
  let base = 0;
  let anchor: number | null = null;
  const read = () => base + (anchor === null ? 0 : (now() - anchor) / 1000);
  return {
    read, playing: () => anchor !== null,
    play() { anchor ??= now(); },
    pause() { base = read(); anchor = null; },
    seek(t: number) { base = Math.max(0, t); if (anchor !== null) anchor = now(); },
  };
}
