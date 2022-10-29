export function durationString(ms) {
  const ds = Math.floor(ms / 1000);
  const dm = Math.floor(ds / 60);
  return `${dm}m ${ds % 60}s`;
}
