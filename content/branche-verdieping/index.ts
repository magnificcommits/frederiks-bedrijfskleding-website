import type { BrancheVerdieping } from './type';
import { verdieping as bouw } from './bouw-en-infra';
import { verdieping as installatie } from './installatie-en-techniek';
import { verdieping as industrie } from './industrie-en-logistiek';
import { verdieping as horeca } from './horeca-en-food';
import { verdieping as zorg } from './zorg-en-salon';
import { verdieping as agrarisch } from './agrarisch-en-groen';
import { verdieping as kantoor } from './kantoor-en-retail';
import { verdieping as clubs } from './clubs-en-verenigingen';

export type { BrancheVerdieping } from './type';

export const verdiepingBySlug: Record<string, BrancheVerdieping> = Object.fromEntries(
  [bouw, installatie, industrie, horeca, zorg, agrarisch, kantoor, clubs]
    .filter((v): v is BrancheVerdieping => v !== null)
    .map((v) => [v.slug, v]),
);
