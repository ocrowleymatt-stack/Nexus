
import JSZip from 'jszip';

export interface ZipNode {
  path: string;
  name: string;
  dir: boolean;
  size: number;
}

export async function inspectZip(file: File): Promise<ZipNode[]> {
  const zip = new JSZip();
  const content = await zip.loadAsync(file);
  const nodes: ZipNode[] = [];

  content.forEach((relativePath, zipEntry) => {
    nodes.push({
      path: relativePath,
      name: zipEntry.name.split('/').pop() || "",
      dir: zipEntry.dir,
      size: (zipEntry as any)._data?.uncompressedSize || 0
    });
  });

  return nodes;
}

export async function getZipJson(file: File, path: string): Promise<any> {
  const zip = new JSZip();
  const content = await zip.loadAsync(file);
  const zipEntry = content.file(path);
  if (!zipEntry) return null;
  const text = await zipEntry.async('string');
  try {
    return JSON.parse(text);
  } catch (e) {
    console.error(`Failed to parse JSON for ${path}`, e);
    return null;
  }
}
