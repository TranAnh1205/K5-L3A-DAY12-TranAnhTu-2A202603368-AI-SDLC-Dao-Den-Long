// Claude Code Stop hook: blocks the agent from finishing while tests are red.
// Exit 2 = block and feed stderr back to the agent.
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const r = spawnSync(process.execPath, ['--test', 'tests/*.test.js'], { cwd: root, encoding: 'utf8' });
if (r.status !== 0) {
  const fails = (r.stdout + r.stderr).split('\n').filter((l) => /✖|not ok|AssertionError|Error:/.test(l)).slice(0, 20).join('\n');
  process.stderr.write(`Tests are failing — fix them before finishing (npm test):\n${fails}\n`);
  process.exit(2);
}
process.exit(0);
