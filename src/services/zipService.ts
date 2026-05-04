/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import JSZip from 'jszip';

export interface ZipMetadata {
  fileTree: string[];
  fileCount: number;
  totalSize: number;
  interestingFiles: string[];
}

export async function analyzeZipFile(file: File): Promise<ZipMetadata> {
  const zip = new JSZip();
  const content = await zip.loadAsync(file);
  
  const fileTree: string[] = [];
  let totalSize = 0;
  let fileCount = 0;
  
  content.forEach((path, entry) => {
    if (!entry.dir) {
      fileTree.push(path);
      fileCount++;
      // entry._data.uncompressedSize is not always accessible directly depending on jszip version
      // but let's try to estimate or ignore for now if not critical
    }
  });

  // Filter for potentially high-value metadata files
  const interestingPatterns = [
    /\.json$/i,
    /\.csv$/i,
    /\.xml$/i,
    /contacts/i,
    /messages/i,
    /posts/i,
    /profile/i,
    /metadata/i,
    /location/i,
    /history/i
  ];

  const interestingFiles = fileTree.filter(path => 
    interestingPatterns.some(pattern => pattern.test(path))
  ).slice(0, 50); // Limit to first 50 interesting ones

  return {
    fileTree: fileTree.slice(0, 500), // Sample tree
    fileCount,
    totalSize: file.size,
    interestingFiles
  };
}

export async function getZipFileContent(file: File, path: string): Promise<string | null> {
  const zip = new JSZip();
  const content = await zip.loadAsync(file);
  const entry = content.file(path);
  if (!entry) return null;
  return await entry.async('string');
}
