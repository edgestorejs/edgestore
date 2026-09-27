/**
 * @internal
 * @see https://github.com/ianstormtaylor/superstruct/blob/7973400cd04d8ad92bbdc2b6f35acbfb3c934079/src/utils.ts#L323-L325
 */
export type Simplify<TType> = TType extends any[] | Date
  ? TType
  : { [K in keyof TType]: TType[K] };

/**
 * @internal
 */
export type Prettify<TType> = {
  [K in keyof TType]: TType[K];
} & {};

/**
 * @public
 */
export type MaybePromise<TType> = Promise<TType> | TType;

/**
 * Get the keys of a union type.
 * @internal
 */
export type KeysOfUnion<TUnion> = TUnion extends TUnion
  ? keyof TUnion extends string
    ? keyof TUnion
    : string
  : never;
