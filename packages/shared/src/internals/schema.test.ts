import { type StandardSchemaV1 } from '@standard-schema/spec';
import { type } from 'arktype';
import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { NO_INPUT, parseBucketInput } from './schema';

const schemas = [
  {
    name: 'Zod',
    schema: z.object({ value: z.string() }),
  },
  {
    name: 'Valibot',
    schema: v.object({ value: v.string() }),
  },
  {
    name: 'ArkType',
    schema: type({ value: 'string' }),
  },
];

describe('parseBucketInput', () => {
  it.each(schemas)('validates $name schemas', async ({ schema }) => {
    await expect(parseBucketInput(schema, { value: 'valid' })).resolves.toEqual(
      { value: 'valid' },
    );
    await expect(
      parseBucketInput(schema, { value: 123 }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('supports hand-written asynchronous Standard Schemas', async () => {
    const schema: StandardSchemaV1<{ raw: string }, { normalized: string }> = {
      '~standard': {
        version: 1,
        vendor: 'edgestore-test',
        async validate(value) {
          await Promise.resolve();
          if (
            typeof value !== 'object' ||
            value === null ||
            !('raw' in value) ||
            typeof value.raw !== 'string'
          ) {
            return { issues: [{ message: 'raw must be a string' }] };
          }
          return { value: { normalized: value.raw.trim().toUpperCase() } };
        },
      },
    };

    await expect(parseBucketInput(schema, { raw: ' value ' })).resolves.toEqual(
      { normalized: 'VALUE' },
    );
    await expect(parseBucketInput(schema, { raw: 123 })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'Invalid input: raw must be a string',
    });
  });

  it('returns an empty object for schema-less buckets', async () => {
    await expect(parseBucketInput(NO_INPUT, undefined)).resolves.toEqual({});
  });
});
