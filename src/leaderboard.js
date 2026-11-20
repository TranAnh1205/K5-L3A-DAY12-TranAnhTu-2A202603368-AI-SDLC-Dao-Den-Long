// Leaderboard — persistent top-10 high scores, file-backed JSON.
// Used by headless.js (--export-leaderboard) and optionally client.js.
import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_PATH = path.resolve('leaderboard.json');
const MAX_ENTRIES = 10;

function load(file = DEFAULT_PATH) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return [];
  }
}

function save(entries, file = DEFAULT_PATH) {
  fs.writeFileSync(file, JSON.stringify(entries, null, 2) + '\n');
}

/** Add a run to the leaderboard. Returns the updated top-10 list. */
function addEntry(entry, file = DEFAULT_PATH) {
  const { name, score, night, seed, reason, timestamp } = entry;
  if (typeof score !== 'number' || !isFinite(score)) throw new Error('score must be a finite number');
  const entries = load(file);
  entries.push({ name: String(name ?? 'anonymous'), score, night, seed, reason, timestamp: timestamp ?? new Date().toISOString() });
  entries.sort((a, b) => b.score - a.score);
  const top = entries.slice(0, MAX_ENTRIES);
  save(top, file);
  return top;
}

/** Return top-10 without modifying. */
function getTop(file = DEFAULT_PATH) {
  return load(file);
}

export { addEntry, getTop, load, save, DEFAULT_PATH, MAX_ENTRIES };
