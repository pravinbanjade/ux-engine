#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { buildProfile } from './lib/profile.mjs';

const args = process.argv.slice(2);
const root = resolve(args.find((a) => !a.startsWith('--')) ?? '.');
const outFlag = args.indexOf('--out');
const out = outFlag === -1 ? join(root, '.ux-engine/profile.json') : resolve(args[outFlag + 1]);

const profile = buildProfile(root);
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, `${JSON.stringify(profile, null, 2)}\n`);

const low = Object.entries(profile.confidence).filter(([, v]) => v === 'low').map(([k]) => k);
console.log(`Wrote ${out}`);
console.log(`styling=${profile.styling.system ?? 'unknown'} components=${profile.components.dir ?? 'unknown'}`);
if (low.length) console.log(`LOW CONFIDENCE: ${low.join(', ')} — ask the user and write the answers back.`);
