import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = process.cwd();
const fixture = join(root, 'data', 'demo-case.json');
const dir = join(root, '.local');
const stateFile = join(dir, 'case.json');

export async function loadFixture() {
  return JSON.parse(await readFile(fixture, 'utf8'));
}

export async function loadCase() {
  try { return JSON.parse(await readFile(stateFile, 'utf8')); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    return loadFixture();
  }
}

export async function saveCase(caseFile) {
  await mkdir(dir, { recursive: true });
  const temp = `${stateFile}.${process.pid}.tmp`;
  await writeFile(temp, JSON.stringify(caseFile, null, 2), { flag: 'w' });
  await rename(temp, stateFile);
}

export async function resetCase() {
  const fresh = await loadFixture();
  await saveCase(fresh);
  return fresh;
}
