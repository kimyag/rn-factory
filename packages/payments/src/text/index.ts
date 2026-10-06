import type { TextSet } from '@factory/app';

import { en } from './en.ts';
import { tr } from './tr.ts';

export const text = { en, tr } satisfies TextSet<typeof en>;
