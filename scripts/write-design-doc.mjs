#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { buildProfile } from './lib/profile.mjs';
import { renderDesignDoc, extractExceptions } from './lib/design-doc.mjs';

const root = resolve(process.argv[2] ?? '.');
const path = join(root, 'DESIGN.md');
const profilePath = join(root, '.ux-engine/profile.json');

const profile = existsSync(profilePath)
  ? JSON.parse(readFileSync(profilePath, 'utf8'))
  : buildProfile(root);

const exceptions = existsSync(path) ? extractExceptions(readFileSync(path, 'utf8')) : undefined;
writeFileSync(path, renderDesignDoc(profile, exceptions));
console.log(`Wrote ${path}`);
