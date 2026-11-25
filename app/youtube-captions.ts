interface Track { baseUrl: string; languageCode: string; kind?: string }
export function captionTrack(html: string, videoId: string) {
  // Decode just the bounded JSON array the watch page supplies. Titles can contain brackets.
  const marker = /"captionTracks"\s*:\s*\[/.exec(html);
  if (!marker) return null;
  const start = marker.index + marker[0].length - 1;
  let depth = 0, quoted = false, escaped = false;
  for (let i = start; i < Math.min(html.length, start + 300000); i++) {
    const c = html[i];
    if (quoted) {
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === '"') quoted = false;
    } else if (c === '"') quoted = true;
    else if (c === '[') depth++;
    else if (c === ']' && --depth === 0) {
      const raw = JSON.parse(html.slice(start,i + 1)) as Track[];
      const tracks = raw.filter(t => {
        if (!t || typeof t.baseUrl !== 'string' || typeof t.languageCode !== 'string') return false;
        try {
          const u = new URL(t.baseUrl);
          return u.origin === 'https://www.youtube.com' && !u.username && !u.password &&
            u.pathname === '/api/timedtext' && u.searchParams.get('v') === videoId;
        } catch { return false; }
      });
      const en = tracks.filter(t => /^en(?:-|$)/i.test(t.languageCode));
      return en.find(t => t.kind !== 'asr') ?? en[0] ?? tracks[0] ?? null;
    }
  }
  return null;
}

export function transcriptCues(input: string, duration: number | null) {
  const groups: {start:number; text:string[]}[] = [];
  const bracketed = /^\[\d+:/.test(input.trim());
  for (const raw of input.trim().split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const match = bracketed
      ? /^\[((?:\d+:)?\d{1,3}:[0-5]\d)\](?:\s+(.+))?$/.exec(line)
      : /^((?:\d+:)?\d{1,3}:[0-5]\d)(?:\s+(.+))?$/.exec(line);
    if (match) {
      const start = match[1].split(':').reduce((sum,part) => sum*60+Number(part),0);
      const last = groups.at(-1);
      if (last && start < last.start) throw Error('The transcript timestamps must run in order.');
      if (!last || start !== last.start) groups.push({start,text:[]});
      if (match[2]) groups.at(-1)!.text.push(match[2]);
    } else groups.at(-1)?.text.push(line);
  }
  if (!groups.some(g => g.text.length)) throw Error('Copy the transcript with its timestamps visible.');
  return groups.map((g,i) => ({
    start:g.start,end:groups[i+1]?.start ?? (duration && duration>g.start ? duration : Infinity),text:g.text.join(' ')
  })).filter(c=>c.text);
}
