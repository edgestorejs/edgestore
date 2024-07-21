/**
 * Check if a route matches the current path.
 */
export function matchPath(pathname: string, route: string) {
  // Allow trailing slash
  // Allow query string
  const regex = new RegExp(`${route}/?(\\?.*)?$`);
  return regex.test(pathname);
}
