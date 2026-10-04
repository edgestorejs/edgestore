type AnyFunction = (...args: never[]) => unknown;

export type ProjectOperationTree<TClient> = {
  [TResource in keyof TClient]: {
    [
      TOperation in keyof TClient[TResource]
    ]: TClient[TResource][TOperation] extends AnyFunction
      ? Parameters<TClient[TResource][TOperation]>[0] extends {
          project: string;
        }
        ? TClient[TResource][TOperation]
        : never
      : never;
  };
};

type CurrentProjectInput<TInput> = TInput extends object
  ? Omit<TInput, 'project'> & { project?: never }
  : never;

type ScopedProjectOperation<TOperation> = TOperation extends (
  input: infer TInput,
) => infer TResult
  ? Record<string, never> extends CurrentProjectInput<TInput>
    ? (input?: CurrentProjectInput<TInput>) => TResult
    : (input: CurrentProjectInput<TInput>) => TResult
  : never;

export type ScopedProjectOperationTree<TOperations> = {
  [TResource in keyof TOperations]: {
    [TOperation in keyof TOperations[TResource]]: ScopedProjectOperation<
      TOperations[TResource][TOperation]
    >;
  };
};

export function scopeProjectOperations<
  TOperations extends Record<string, Record<string, AnyFunction>>,
>(
  operations: TOperations,
  project: string,
): ScopedProjectOperationTree<TOperations> {
  const entries = Object.entries(operations).map(([resourceName, resource]) => [
    resourceName,
    Object.fromEntries(
      Object.entries(resource).map(([operationName, operation]) => [
        operationName,
        (input: object | undefined) =>
          operation({ ...input, project } as never),
      ]),
    ),
  ]);

  return Object.fromEntries(entries) as ScopedProjectOperationTree<TOperations>;
}
