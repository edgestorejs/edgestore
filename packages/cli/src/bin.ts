import { createRequire } from 'node:module';
import { runCli } from './cli';
import { createDefaultRuntime } from './core/runtime';

const require = createRequire(import.meta.url);
const packageJson = require('../package.json') as { version: string };
const abortController = new AbortController();
let interruptCount = 0;

const onInterrupt = () => {
  interruptCount += 1;
  if (interruptCount === 1) {
    abortController.abort();
    return;
  }
  process.exit(130);
};

process.on('SIGINT', onInterrupt);

try {
  process.exitCode = await runCli(
    process.argv.slice(2),
    createDefaultRuntime(abortController.signal),
    packageJson.version,
  );
} finally {
  process.off('SIGINT', onInterrupt);
}
