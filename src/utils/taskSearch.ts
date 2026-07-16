export function matchesTaskSearch(title: string, assigneeName: string, query: string): boolean {
  const q = query.toLowerCase();
  return title.toLowerCase().includes(q) || assigneeName.toLowerCase().includes(q);
}
