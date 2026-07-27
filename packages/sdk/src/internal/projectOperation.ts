const projectOperationMarker = Symbol('EdgeStoreProjectOperation');

type AnyFunction = (...args: never[]) => unknown;

export type ProjectOperation<TFunction extends AnyFunction = AnyFunction> =
  TFunction & {
    readonly [projectOperationMarker]: true;
  };

export type ProjectOperationTree<TClient> = {
  [TResource in keyof TClient]: {
    [
      TOperation in keyof TClient[TResource]
    ]: TClient[TResource][TOperation] extends AnyFunction
      ? ProjectOperation<TClient[TResource][TOperation]>
      : never;
  };
};

type CurrentProjectInput<TInput> = TInput extends object
  ? Omit<TInput, 'project'> & { project?: never }
  : never;

type ScopedProjectOperation<TOperation> =
  TOperation extends ProjectOperation<(input: infer TInput) => infer TResult>
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

export function projectOperation<TInput extends { project: string }, TResult>(
  operation: (input: TInput) => TResult,
): ProjectOperation<(input: TInput) => TResult> {
  Object.defineProperty(operation, projectOperationMarker, {
    value: true,
  });
  return operation as ProjectOperation<(input: TInput) => TResult>;
}

export function scopeProjectOperations<
  TOperations extends Record<
    string,
    Record<string, ProjectOperation<AnyFunction>>
  >,
>(
  operations: TOperations,
  project: string,
): ScopedProjectOperationTree<TOperations> {
  const entries = Object.entries(operations).map(([resourceName, resource]) => [
    resourceName,
    Object.fromEntries(
      Object.entries(resource).map(([operationName, operation]) => {
        if (
          typeof operation !== 'function' ||
          !(projectOperationMarker in operation)
        ) {
          throw new TypeError(
            `Runtime operation ${resourceName}.${operationName} is not project-scoped.`,
          );
        }
        return [
          operationName,
          (input: object | undefined) =>
            operation({ ...input, project } as never),
        ];
      }),
    ),
  ]);

  return Object.fromEntries(entries) as ScopedProjectOperationTree<TOperations>;
}
