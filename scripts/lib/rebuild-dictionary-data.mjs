import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { resolve } from "node:path";

const execFileAsync = promisify(execFile);

/**
 * The canonical dictionary is edited in-place. This helper now validates the
 * bundle after a mutation; it never regenerates it from retired sidecar files.
 */
export async function rebuildDictionaryData(root) {
  const { stdout, stderr } = await execFileAsync(
    process.execPath,
    [resolve(root, "scripts/build-dictionary-data.mjs"), "--check"],
    { cwd: root, maxBuffer: 16 * 1024 * 1024 }
  );
  if (stdout) process.stdout.write(stdout);
  if (stderr) process.stderr.write(stderr);
}
