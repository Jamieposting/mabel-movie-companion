// YouTube changes captions before getCurrentTime necessarily acknowledges seekTo.
// Keep a single clock for the scene reader and polling observer.
export function youtubeClock() {
  let pending: {from:number; target:number} | null = null;
  let failed = false;
  return {
    seek(from:number, target:number, duration:number) {
      const end = Number.isFinite(duration) && duration > 0 ? duration : Infinity;
      const destination = Math.max(0, Math.min(target,end));
      pending = {from,target:destination};
      return destination;
    },
    fail() { failed = true; },
    read(time:number, state:number) {
      if (failed || !Number.isFinite(time) || time < 0 || state === 3) return null;
      if (pending) {
        if (![0,1,2].includes(state)) return null;
        const {from,target} = pending;
        // A short backwards seek must not release later dialogue on the old clock.
        if ((target < from && time >= from) || (target > from && time <= from)) return null;
        const nearTarget = Math.abs(time-target) <= 0.5;
        const keyframe = time <= target && target-time <= 5 &&
          Math.abs(time-target) < Math.abs(time-from);
        if (!nearTarget && !keyframe) return null;
        pending = null;
      }
      return time;
    }
  };
}
