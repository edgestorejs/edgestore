import { generateEntrypoints } from '../../scripts/entrypoints';
import { input } from './rollup.config';

void (async () => {
  await generateEntrypoints(input);
})();
