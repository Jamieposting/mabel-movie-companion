export type Cue = { start: number; end: number; text: string };
export type Style = 'Quiet Companion' | 'Occasional Commentary' | 'Chatty Companion';

function seconds(clock: string) {
  return clock.replace(',', '.').split(':').reduce((n, part) => n * 60 + Number(part), 0);
}

export function parseSubtitles(input: string): Cue[] {
  const clock = '(?:(?:\\d{2,}):)?[0-5]\\d:[0-5]\\d[.,]\\d{3}';
  const timing = new RegExp('^(' + clock + ')\\s+-->\\s+(' + clock + ')(?:\\s+.*)?$');
  const cues: Cue[] = [];
  for (const block of input.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').trim().split(/\n[ \t]*\n/)) {
    const lines = block.trim().split('\n');
    if (/^(WEBVTT(?:\s|$)|NOTE(?:\s|$)|STYLE$|REGION$)/.test(lines[0])) continue;
    const index = lines[0].includes('-->') ? 0 : 1;
    const match = timing.exec(lines[index]?.trim() ?? '');
    if (!match) throw Error('A cue has an unreadable timestamp. Check the SRT or WebVTT file.');
    const start = seconds(match[1]), end = seconds(match[2]);
    if (end <= start) throw Error('A subtitle ends before or at its start.');
    const body = lines.slice(index + 1);
    if (body.some(line => line.includes('-->'))) throw Error('Separate subtitle cues with a blank line.');
    const text = body.join(' ').replace(/<v ([^>]+)>/g, '$1: ').replace(/<[^>]*>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').trim();
    if (text) cues.push({start, end, text});
  }
  if (!cues.length) throw Error('No subtitle cues found. Choose a UTF-8 SRT or WebVTT file.');
  return cues.sort((a,b) => a.start - b.start);
}

export function scene(cues: Cue[], time: number | null, offset: number, before = Infinity) {
  const cutoff = time === null ? -Infinity : time - offset;
  const watched = cues.filter(c => c.end <= cutoff);
  const count = Math.min(watched.length, Math.max(0, Math.floor(before)));
  const from = Math.max(0, count - 48);
  return {
    completed: watched.length,
    earlierBefore: from || null,
    dialogue: watched.slice(from, count).map(c => ({ at: Math.max(0, c.start + offset), line: c.text })),
    speaking: cues.some(c => c.start <= cutoff && cutoff < c.end),
  };
}

export function inCommentaryGap(cues: Cue[], time: number, offset: number) {
  const t = time - offset;
  return cues.length > 0 && !cues.some(c => c.start < t + 3 && c.end > t);
}
