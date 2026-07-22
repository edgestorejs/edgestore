import { createEdgeStoreProvider } from '@edgestore/react';
import { initEdgeStoreClient } from '@edgestore/server/core';
import { initEdgeStore } from '@edgestore/shared';
import { type StandardSchemaV1 } from '@standard-schema/spec';
import { type } from 'arktype';
import { expectType } from 'tsd';
import * as v from 'valibot';

const es = initEdgeStore.create();

const valibotBucket = es
  .fileBucket()
  .input(
    v.object({
      count: v.pipe(
        v.string(),
        v.transform((value) => Number(value)),
      ),
    }),
  )
  .beforeUpload(({ input }) => {
    expectType<number>(input.count);
    return true;
  });

const arkTypeBucket = es
  .fileBucket()
  .input(type({ category: "'invoice' | 'contract'" }))
  .beforeUpload(({ input }) => {
    expectType<'invoice' | 'contract'>(input.category);
    return true;
  });

declare const customSchema: StandardSchemaV1<
  { raw: string },
  { normalized: string }
>;
const customBucket = es
  .fileBucket()
  .input(customSchema)
  .beforeUpload(({ input }) => {
    expectType<string>(input.normalized);
    return true;
  });

const router = es.router({ valibotBucket, arkTypeBucket, customBucket });
const client = initEdgeStoreClient({ router });
const { useEdgeStore } = createEdgeStoreProvider<typeof router>();
const { edgestore } = useEdgeStore();

void client.valibotBucket.upload({
  content: 'hello',
  input: { count: '2' },
});
void client.arkTypeBucket.upload({
  content: 'hello',
  input: { category: 'invoice' },
});
void client.customBucket.upload({
  content: 'hello',
  input: { raw: 'value' },
});

void edgestore.valibotBucket.upload({
  file: {} as File,
  input: { count: '2' },
});
void edgestore.arkTypeBucket.upload({
  file: {} as File,
  input: { category: 'contract' },
});
void edgestore.customBucket.upload({
  file: {} as File,
  input: { raw: 'value' },
});
