import { index, route, type RouteConfig } from '@react-router/dev/routes';

export default [
  index('routes/home.tsx'),
  route('api/edgestore/*', 'routes/api/edgestore.ts'),
] satisfies RouteConfig;
