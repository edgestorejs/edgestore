type RecursivePathProxy = {
  (): string;
  ctx: any;
  input: any;
};

/**
 * Creates a Proxy that prints the path to the property when called.
 *
 * Example:
 *
 * ```ts
 * const pathParamProxy = createPathParamProxy();
 * console.log(pathParamProxy.ctx.user.id());
 * // Logs: "ctx.user.id"
 * console.log(pathParamProxy.input.type());
 * // Logs: "input.type"
 * ```
 */
export function createPathParamProxy(): RecursivePathProxy {
  const getPath = (
    target: string,
    _prop: string | symbol,
  ): RecursivePathProxy => {
    const proxyFunction: RecursivePathProxy = (() =>
      target) as RecursivePathProxy;

    return new Proxy(proxyFunction, {
      get: (_target, propChild) => {
        return getPath(`${target}.${String(propChild)}`, propChild);
      },
    });
  };

  return new Proxy((() => '') as RecursivePathProxy, {
    get: (_target, prop) => {
      return getPath(String(prop), String(prop));
    },
  });
}
