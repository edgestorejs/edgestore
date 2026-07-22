import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { API_V2_SCHEMA_SHA256, API_V2_SOURCE_COMMIT } from './source';

type JsonObject = Record<string, unknown>;
type OpenApiOperation = JsonObject & {
  operationId?: string;
  summary?: string;
  description?: string;
  parameters?: unknown;
  requestBody?: unknown;
};

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

    expect(API_V2_SOURCE_COMMIT).toBe('bf4bf0c');
    expect(createHash('sha256').update(schemaBytes).digest('hex')).toBe(
      API_V2_SCHEMA_SHA256,
    );
    expect(schema.openapi).toBe('3.1.1');
    expect(schema.info.version).toBe('2.0.0');
    expect(operationCount).toBe(57);
  });

  it('documents generated operations and their public inputs', async () => {
    const schemaUrl = new URL('./openapi-v2.json', import.meta.url);
    const schema = JSON.parse(await readFile(schemaUrl, 'utf8')) as {
      components?: { schemas?: JsonObject };
      paths: Record<string, Record<string, OpenApiOperation>>;
    };
    const operations = Object.values(schema.paths).flatMap((path) =>
      Object.values(path).filter((operation) => operation.operationId),
    );

    expect(
      operations
        .filter((operation) => !hasText(operation.summary))
        .map((operation) => operation.operationId),
    ).toEqual([]);
    expect(
      operations
        .filter((operation) => !hasText(operation.description))
        .map((operation) => operation.operationId),
    ).toEqual([]);

    const undocumentedProperties: string[] = [];
    const documentationRoots: [path: string, value: unknown][] = [
      ['components.schemas', schema.components?.schemas],
      ...operations.flatMap((operation): [path: string, value: unknown][] => [
        [`${operation.operationId}.parameters`, operation.parameters],
        [`${operation.operationId}.requestBody`, operation.requestBody],
      ]),
    ];
    let propertyCount = 0;

    for (const [path, value] of documentationRoots) {
      propertyCount += collectUndocumentedProperties(
        value,
        path,
        undocumentedProperties,
      );
    }

    expect(propertyCount).toBeGreaterThan(0);
    expect(undocumentedProperties).toEqual([]);
  });
});

function collectUndocumentedProperties(
  value: unknown,
  path: string,
  undocumentedProperties: string[],
): number {
  if (Array.isArray(value)) {
    return value.reduce(
      (count, item, index) =>
        count +
        collectUndocumentedProperties(
          item,
          `${path}[${index}]`,
          undocumentedProperties,
        ),
      0,
    );
  }
  if (!isJsonObject(value)) return 0;

  let propertyCount = 0;
  if (isJsonObject(value.properties)) {
    for (const [name, property] of Object.entries(value.properties)) {
      propertyCount += 1;
      if (!isJsonObject(property) || !hasText(property.description)) {
        undocumentedProperties.push(`${path}.properties.${name}`);
      }
    }
  }

  return Object.entries(value).reduce(
    (count, [name, child]) =>
      count +
      collectUndocumentedProperties(
        child,
        `${path}.${name}`,
        undocumentedProperties,
      ),
    propertyCount,
  );
}

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
