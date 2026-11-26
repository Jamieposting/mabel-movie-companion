// Two independent, one-use colour strips bind a device screenshot to a paused scene.
export const cell = 6;
export const stripHeight = 8;
export const palette = ['#ed1651','#17e29b','#5236ed','#ece51c','#1abfee','#f37e22'];
const rgb = palette.map(s => [1,3,5].map(i => parseInt(s.slice(i,i+2),16)));
export function newStrip() {
  const bytes = crypto.getRandomValues(new Uint8Array(14));
  const strip:number[] = [];
  for (const byte of bytes) {
    const previous = strip.at(-1);
    const choices = palette.map((_,i)=>i).filter(i=>i!==previous);
    strip.push(choices[byte % choices.length]);
  }
  return strip;
}

export function findPlayerCrop(data:Uint8ClampedArray, width:number, height:number,
  top:number[], bottom:number[], cssWidth:number, cssHeight:number) {
  if (width*height>16000000 || data.length!==width*height*4) return null;
  function matches(x:number,y:number,color:number) {
    if (x<0 || x>=width || y>=height) return false;
    const p=4*(y*width+x), c=rgb[color];
    return Math.abs(data[p]-c[0])<24 && Math.abs(data[p+1]-c[1])<24 && Math.abs(data[p+2]-c[2])<24;
  }
  function locate(strip:number[]) {
    let found:{x:number;y:number;step:number}|undefined;
    for(let y=0;y<height;y+=2) {
      for(let x=0;x<width;x++) {
        if(!matches(x,y,strip[0])) continue;
        const start=x;
        while(x<width && matches(x,y,strip[0])) x++;
        const run=x-start;
        if(run<3 || run>48) continue;
        // Account for pixel rounding at either edge of the first cell.
        for(let eighth=-8;eighth<=8;eighth++) {
          const step=run+eighth/8;
          if(!strip.every((v,i)=>matches(start+Math.floor((i+0.5)*step),y,v))) continue;
          if(found && (Math.abs(found.x-start)>2 || Math.abs(found.y-y)>step*2)) return null;
          if(!found) found={x:start,y,step};
          break;
        }
      }
    }
    return found;
  }
  const a=locate(top), b=locate(bottom);
  if(!a || !b || !Number.isFinite(cssWidth) || !Number.isFinite(cssHeight) || cssWidth<=0 || cssHeight<=stripHeight*2) return null;
  const scale=(b.y-a.y)/(cssHeight-stripHeight);
  if(scale<=0 || Math.abs(a.step-cell*scale)>1.2 || Math.abs(b.step-cell*scale)>1.2) return null;
  const end=b.x+bottom.length*cell*scale;
  if(Math.abs(end-a.x-cssWidth*scale)>4*scale+3) return null;
  // Inset conservatively. Exclude both marker strips and all surrounding page pixels.
  const x=Math.ceil(a.x+3*scale), y=Math.ceil(a.y+(stripHeight+2)*scale);
  const w=Math.floor(end-3*scale)-x, h=Math.floor(b.y-2*scale)-y;
  return w>0 && h>0 && x+w<=width && y+h<=height ? {x,y,width:w,height:h} : null;
}

export type PausedScene = {session:string;epoch:number;rate:number;time:number;scene:unknown};
export function samePause(a:PausedScene,b:PausedScene|null) {
  return !!b && a.session===b.session && a.epoch===b.epoch && a.rate===b.rate && a.time===b.time;
}
