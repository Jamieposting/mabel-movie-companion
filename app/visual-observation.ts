// Coordinates are rounded inward so surrounding page content stays out of the crop.
export function playerClip(rect: DOMRect, viewportWidth:number, viewportHeight:number) {
  if (rect.left<0 || rect.top<0 || rect.right>viewportWidth || rect.bottom>viewportHeight) return null;
  const x=Math.ceil(rect.left), y=Math.ceil(rect.top);
  const width=Math.floor(rect.right)-x, height=Math.floor(rect.bottom)-y;
  return width>0 && height>0 ? {x,y,width,height} : null;
}

export type FrameCheckpoint = {
  session:string; epoch:number; sampledAt:number; rate:number; status:string;
  clip:NonNullable<ReturnType<typeof playerClip>>; pixelRatio:number;
  scene:{positionSeconds:number;[key:string]:unknown};
};

export function canPair(before:FrameCheckpoint, after:FrameCheckpoint, now:number) {
  const elapsed=(after.sampledAt-before.sampledAt)/1000;
  const advance=after.scene.positionSeconds-before.scene.positionSeconds;
  return after.session===before.session && after.epoch===before.epoch &&
    after.status===before.status && ['playing','paused','ended'].includes(after.status) &&
    after.rate===before.rate && Number.isFinite(after.rate) && after.rate>0 &&
    now>=after.sampledAt && now-before.sampledAt<=1200 && elapsed>0 &&
    Number.isFinite(before.scene.positionSeconds) && before.scene.positionSeconds>=0 &&
    advance>=0 && advance<=0.5 &&
    (after.status==='playing' ? Math.abs(advance-elapsed*after.rate)<=0.2 : advance===0) &&
    after.pixelRatio===before.pixelRatio &&
    (['x','y','width','height'] as const).every(k=>after.clip[k]===before.clip[k]);
}
