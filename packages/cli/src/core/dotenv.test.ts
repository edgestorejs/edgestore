import { expect, it } from 'vitest';
import { projectEnvValue } from './dotenv';

it.each(['ACCESS_KEY', 'SECRET_KEY'] as const)(
  'resolves canonical, legacy, mixed, and empty %s assignments',
  (suffix) => {
    const name = `EDGESTORE_${suffix}` as const;
    const legacy = `EDGE_STORE_${suffix}`;
    expect(projectEnvValue('', name)).toBeUndefined();
    expect(projectEnvValue(`${legacy}=existing`, name)).toBe('existing');
    expect(
      projectEnvValue(`export ${name} = "canonical"\n${legacy}=existing`, name),
    ).toBe('canonical');
    expect(projectEnvValue(`${legacy}=existing\n${name}=`, name)).toBe('');
    expect(projectEnvValue(`${name}=first\n${name}=last`, name)).toBe('last');
  },
);
