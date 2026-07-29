import path from 'node:path';
import {
  formatInspection,
  inspectRelease,
  parseReleaseOptions,
} from './releaseLanes';

async function main() {
  const repoRoot = path.resolve(__dirname, '../..');
  const inspection = await inspectRelease(
    repoRoot,
    parseReleaseOptions(process.argv.slice(2)),
  );
  console.log(formatInspection(inspection));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
