import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { resolve } from "node:path";

const execFileAsync = promisify(execFile);

/**
 * Rebuild the single browser/admin runtime bundle after a source-data mutation.
 * The component JSON files remain the editable source files; dictionary-data.json
 * is always regenerated through the same validated builder.
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
