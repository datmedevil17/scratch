'use server';

import fs from 'fs/promises';
import path from 'path';

export interface AssetNode {
  name: string;
  type: 'file' | 'folder';
  url: string; 
  extension?: string;
}

export async function getDirectoryContents(subpath: string): Promise<AssetNode[]> {
  try {
    const publicDir = path.join(process.cwd(), 'public');
    // Normalize and resolve the target path to prevent directory traversal
    const targetDir = path.resolve(path.join(publicDir, subpath));

    if (!targetDir.startsWith(publicDir)) {
       throw new Error('Invalid path: Directory traversal not allowed');
    }
    
    // Check if the path exists
    try {
      await fs.access(targetDir);
    } catch {
      return [];
    }

    const entries = await fs.readdir(targetDir, { withFileTypes: true });
    const results: AssetNode[] = [];
    
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue; // skip hidden files

      // Re-calculate the relative path accurately
      const relativePath = path.relative(publicDir, path.join(targetDir, entry.name));
      const urlPath = '/' + relativePath.split(path.sep).join('/');
      
      if (entry.isDirectory()) {
        results.push({
          name: entry.name,
          type: 'folder',
          url: urlPath,
        });
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        results.push({
          name: entry.name,
          type: 'file',
          extension: ext,
          url: urlPath,
        });
      }
    }
    
    // Sort folders first, then files alphabetically
    results.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    return results;
  } catch (err) {
    console.error('Failed to get directory contents:', err);
    return [];
  }
}
