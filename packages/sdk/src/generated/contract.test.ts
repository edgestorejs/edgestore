import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { API_V2_SCHEMA_SHA256, API_V2_SOURCE_COMMIT } from './source';

describe('API v2 contract snapshot', () => {
  it('matches its recorded source and checksum', async () => {
    const schemaUrl = new URL('./openapi-v2.json', import.meta.url);
    const schemaBytes = await readFile(schemaUrl);
    const schema = JSON.parse(schemaBytes.toString()) as {
      openapi: string;
      info: { version: string };
      paths: Record<string, Record<string, { operationId?: string }>>;
    };
    const operationCount = Object.values(schema.paths).reduce(
      (total, path) =>
        total +
        Object.values(path).filter((operation) => operation.operationId).length,
      0,
    );

    expect(API_V2_SOURCE_COMMIT).toBe('8298c66');
    expect(createHash('sha256').update(schemaBytes).digest('hex')).toBe(
      API_V2_SCHEMA_SHA256,
    );
    expect(schema.openapi).toBe('3.1.1');
    expect(schema.info.version).toBe('2.0.0');
    expect(operationCount).toBe(57);
  });
});
