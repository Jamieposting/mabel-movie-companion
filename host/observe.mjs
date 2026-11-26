// Run on the host that owns the browser. Never send screenshots through the R2 relay.
import {canPair} from '../app/visual-observation.ts';

/**
 * read() returns {frame, scene}; capture(frame) must screenshot only frame.clip.
 * For a periodic read, pass the checkpoint returned by watch_observe_next_moment
 * as initial. For a question (including while paused), omit initial.
 */
export async function observe({read,capture,initial,now=Date.now}) {
  const start=initial ?? await read();
  if (!start.frame || !capture) return {scene:start.scene,reason:'visual_unavailable'};
  let image;
  try {
    image=await capture(start.frame);
  } catch {
    const fresh=await read();
    return {scene:fresh.scene,reason:'capture_failed'};
  }
  let end=await read();
  // The visible panel refreshes on a timer. Require a genuinely post-capture
  // sample even when a paused video reports the exact same media position.
  if (end.frame && end.frame.sampledAt<=start.frame.sampledAt) {
    await new Promise(resolve=>setTimeout(resolve,260));
    end=await read();
  }
  if (!image?.byteLength || !end.frame || !canPair(start.frame,end.frame,now())) {
    return {scene:end.scene,reason:'stale_or_unavailable'};
  }
  // The earlier cutoff cannot disclose speech completed after the screenshot.
  return {scene:start.scene,image,mediaRange:[start.scene.positionSeconds,end.scene.positionSeconds]};
}

/** Adapter for a Playwright-compatible page owned by the viewer's chat host.
 * readTool, when present, unwraps the WebMCP tool response into its JSON value.
 * The visible checkpoint panel is an on-demand fallback for browser hosts.
 */
export async function observePlayer(page,{readTool,scheduled=false}={}) {
  const read=readTool ? ()=>readTool('watch_read_checkpoint') : async()=>{
    const field=page.getByLabel('Browser frame checkpoint',{exact:true});
    if (!await field.isVisible()) {
      const dialogue=page.getByLabel('Scene to share',{exact:true});
      if (!await dialogue.isVisible()) return {frame:null,scene:null};
      const text=await dialogue.evaluate(el=>el.value);
      return {frame:null,scene:JSON.parse(text.slice(text.indexOf('\n')+1))};
    }
    return JSON.parse(await field.evaluate(el=>el.value));
  };
  if (scheduled && !readTool) return {reason:'observer_unavailable',...(await read()),image:undefined};
  const initial=scheduled ? await readTool('watch_observe_next_moment') : undefined;
  if (initial && !initial.ok) return initial;
  const result=await observe({read,initial,capture:frame=>page.screenshot({clip:frame.clip})});
  return initial ? {...result,observation:initial.observation} : result;
}
