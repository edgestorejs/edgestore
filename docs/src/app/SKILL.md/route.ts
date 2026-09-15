import { skillDocument } from '@/lib/hostedSkill';

export const dynamic = 'force-static';

export function GET() {
  return skillDocument('SKILL.md');
}
