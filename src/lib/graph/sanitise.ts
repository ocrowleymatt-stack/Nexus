
export function sanitiseId(id: string): string {
  if (!id) return `node_${Math.random().toString(36).substring(7)}`;
  return id
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^[0-9]/, 'n$&');
}

export function cleanText(text: string): string {
  if (!text) return "";
  // Remove control characters and limit length
  return text.replace(/[\x00-\x1F\x7F-\x9F]/g, "").substring(0, 1000);
}
