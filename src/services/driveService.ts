/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
}

export async function searchDriveForIntelligence(query: string, accessToken: string): Promise<DriveFile[]> {
  const searchUrl = `https://www.googleapis.com/drive/v3/files?q=name contains '${query}' and (mimeType = 'text/csv' or mimeType = 'application/zip')&fields=files(id, name, mimeType)`;
  
  try {
    const response = await fetch(searchUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Drive search failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data.files || [];
  } catch (error) {
    console.error("Error searching drive:", error);
    return [];
  }
}

export async function downloadDriveFile(fileId: string, accessToken: string): Promise<Blob> {
  const downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
  
  const response = await fetch(downloadUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Drive download failed: ${response.statusText}`);
  }

  return await response.blob();
}
