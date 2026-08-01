import { describe, expect, it } from 'vitest';
import { planMultipartUpload } from './multipartPlan';
import {
  DEFAULT_MULTIPART_PART_SIZE_BYTES,
  DEFAULT_MULTIPART_THRESHOLD_BYTES,
  MAX_MULTIPART_PARTS,
  MIN_MULTIPART_PART_SIZE_BYTES,
} from './uploadTypes';

describe('planMultipartUpload', () => {
  it('selects single or multipart upload at the canonical threshold', () => {
    expect(
      planMultipartUpload({ sizeBytes: DEFAULT_MULTIPART_THRESHOLD_BYTES }),
    ).toBeNull();

    expect(
      planMultipartUpload({ sizeBytes: DEFAULT_MULTIPART_THRESHOLD_BYTES + 1 }),
    ).toEqual({
      partSizeBytes: DEFAULT_MULTIPART_PART_SIZE_BYTES,
      totalParts: 7,
      partNumbers: [1, 2, 3, 4, 5, 6, 7],
    });
  });

  it('enforces multipart geometry and input constraints', () => {
    const plan = planMultipartUpload({
      sizeBytes: DEFAULT_MULTIPART_PART_SIZE_BYTES * MAX_MULTIPART_PARTS + 1,
      forceMultipart: true,
    });

    expect(plan).not.toBeNull();
    if (!plan) throw new Error('Expected a multipart upload plan.');
    expect(plan.partSizeBytes).toBeGreaterThan(
      DEFAULT_MULTIPART_PART_SIZE_BYTES,
    );
    expect(plan.totalParts).toBeLessThanOrEqual(MAX_MULTIPART_PARTS);
    expect(plan.partNumbers).toHaveLength(plan.totalParts);

    expect(() =>
      planMultipartUpload({
        sizeBytes: 1,
        preferredPartSizeBytes: MIN_MULTIPART_PART_SIZE_BYTES - 1,
        forceMultipart: true,
      }),
    ).toThrow('preferredPartSizeBytes must be at least');
  });
});
