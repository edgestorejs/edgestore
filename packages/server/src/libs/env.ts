export function getEnv(key: string): string | undefined {
  if (typeof process !== 'undefined' && process.env) {
    // @ts-expect-error - In Vite/Astro, env variables are available on import.meta.
    return process.env[key] ?? import.meta.env?.[key];
  }
  // @ts-expect-error - In Vite/Astro, env variables are available on import.meta.
  return import.meta.env?.[key];
}

export function isDev(): boolean {
  return (
    process?.env?.NODE_ENV === 'development' ||
    // @ts-expect-error - In Vite/Astro, env variables are available on import.meta.
    import.meta.env?.DEV
  );
}
