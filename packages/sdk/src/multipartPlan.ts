import {
  assertNonNegative,
  getPositiveInteger,
} from './internal/uploadValidation';
import {
  DEFAULT_MULTIPART_PART_SIZE_BYTES,
  DEFAULT_MULTIPART_THRESHOLD_BYTES,
  MAX_MULTIPART_PARTS,
  MIN_MULTIPART_PART_SIZE_BYTES,
} from './uploadTypes';

/** Inputs used to decide whether and how to split an upload into parts. */
export type MultipartUploadPlanOptions = {
  /** Exact number of bytes in the upload source. */
  sizeBytes: number;
  /** Size above which multipart upload is selected automatically. */
  thresholdBytes?: number;
  /** Preferred size of each part before enforcing the maximum part count. */
  preferredPartSizeBytes?: number;
  /** Select multipart upload regardless of the threshold. */
  forceMultipart?: boolean;
};

/** Resolved multipart transfer geometry. */
export type MultipartUploadPlan = {
  /** Final part size after enforcing the maximum part count. */
  partSizeBytes: number;
  /** Number of parts required to transfer the source. */
  totalParts: number;
  /** One-based part numbers to request from EdgeStore. */
  partNumbers: number[];
};

/**
 * Plans a multipart upload using EdgeStore's canonical thresholds and limits.
 *
 * Returns `null` when the source should use a single upload.
 */
export function planMultipartUpload({
  sizeBytes,
  thresholdBytes = DEFAULT_MULTIPART_THRESHOLD_BYTES,
  preferredPartSizeBytes,
  forceMultipart = false,
}: MultipartUploadPlanOptions): MultipartUploadPlan | null {
  assertNonNegative(sizeBytes, 'sizeBytes');
  assertNonNegative(thresholdBytes, 'thresholdBytes');
  const requestedPartSizeBytes = getPositiveInteger(
    preferredPartSizeBytes,
    DEFAULT_MULTIPART_PART_SIZE_BYTES,
    'preferredPartSizeBytes',
  );
  if (requestedPartSizeBytes < MIN_MULTIPART_PART_SIZE_BYTES) {
    throw new RangeError(
      `preferredPartSizeBytes must be at least ${MIN_MULTIPART_PART_SIZE_BYTES} bytes (5 MiB).`,
    );
  }
  if (!forceMultipart && sizeBytes <= thresholdBytes) return null;

  const partSizeBytes = Math.max(
    requestedPartSizeBytes,
    Math.ceil(sizeBytes / MAX_MULTIPART_PARTS),
  );
  const totalParts = Math.max(1, Math.ceil(sizeBytes / partSizeBytes));

  return {
    partSizeBytes,
    totalParts,
    partNumbers: Array.from({ length: totalParts }, (_, index) => index + 1),
  };
}
