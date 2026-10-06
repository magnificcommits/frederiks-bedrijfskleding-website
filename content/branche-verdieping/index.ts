import type { BrancheVerdieping } from './type';
import { verdieping as bouw } from './bouw-en-infra';
import { verdieping as industrie } from './industrie-en-transport';
import { verdieping as horeca } from './horeca-en-hospitality';
import { verdieping as zorg } from './zorg-en-beauty';
import { verdieping as agri } from './agri-en-milieu';
import { verdieping as representatief } from './representatief';
import { verdieping as sport } from './sport-en-promotie';

export type { BrancheVerdieping } from './type';

export const verdiepingBySlug: Record<string, BrancheVerdieping> = Object.fromEntries(
  [bouw, industrie, horeca, zorg, agri, representatief, sport]
    .filter((v): v is BrancheVerdieping => v !== null)
    .map((v) => [v.slug, v]),
);
