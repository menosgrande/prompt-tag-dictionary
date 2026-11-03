import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { resolve } from "node:path";

const execFileAsync = promisify(execFile);

/**
 * Rebuild the browser/admin runtime bundle from data/master-data.json.
 * Source mutations must be written to the master JSON before this helper runs.
 */
export async function rebuildDictionaryData(root) {
  const { stdout, stderr } = await execFileAsync(
    process.execPath,
    [resolve(root, "scripts/build-dictionary-data.mjs"), "--write"],
    { cwd: root, maxBuffer: 16 * 1024 * 1024 }
  );
  if (stdout) process.stdout.write(stdout);
  if (stderr) process.stderr.write(stderr);
}
