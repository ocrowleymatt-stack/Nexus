
export async function fetchRepoContents(owner: string, repo: string, path: string = '') {
  const response = await fetch('/api/github/repo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ owner, repo, path })
  });
  if (!response.ok) throw new Error('Failed to fetch github repository');
  return response.json();
}

export async function fetchGithubFile(downloadUrl: string) {
  const response = await fetch('/api/github/file', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ downloadUrl })
  });
  if (!response.ok) throw new Error('Failed to fetch github file');
  return response.text();
}
