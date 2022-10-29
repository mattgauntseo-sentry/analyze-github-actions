import { writeFile, readFile } from 'node:fs/promises';
import {ensureFile} from 'fs-extra';
import * as path from 'path';

const CACHE_DIR = '.github-cache';

export async function getCachedData(category, owner, repo, id) {
  const fp = getPath(category, owner, repo, id);
  try {
    const b = await readFile(fp);
    return JSON.parse(b.toString());
  } catch(err) {
    // NOOP
  }
  return null;
}

export async function setCachedData(category, owner, repo, id, data) {
  const fp = getPath(category, owner, repo, id);
  await ensureFile(fp);
  await writeFile(fp, JSON.stringify(data, null, 2));
}

function getPath(category, owner, repo, id) {
  return path.join(CACHE_DIR, category, owner, repo, `${id}.json`)
}
