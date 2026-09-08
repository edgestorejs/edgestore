export function applicationKind(dependencies: Record<string, string>) {
  if (dependencies['@tanstack/react-start'])
    return { framework: 'tanstack-start', role: 'fullstack' } as const;
  if (dependencies.next)
    return { framework: 'next', role: 'fullstack' } as const;
  if (dependencies.hono) return { framework: 'hono', role: 'backend' } as const;
  if (dependencies.vite && dependencies.react)
    return { framework: 'vite', role: 'frontend' } as const;
  if (dependencies.react)
    return { framework: 'react', role: 'frontend' } as const;
  return { framework: 'unknown', role: 'unknown' } as const;
}
