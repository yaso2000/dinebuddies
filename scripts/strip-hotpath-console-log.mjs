#!/usr/bin/env node
/**
 * Remove console.log / console.debug lines from hot-path source files.
 * Keeps console.warn / console.error.
 */
import fs from 'node:fs';

const targets = [
  'src/pages/CreateInvitation.jsx',
  'src/pages/CreateSocialInvitation.jsx',
  'src/pages/CreatePrivateInvitation.jsx',
  'src/services/mediaService.js',
  'src/context/AuthContext.jsx',
];

let changed = 0;
for (const file of targets) {
  if (!fs.existsSync(file)) continue;
  const raw = fs.readFileSync(file, 'utf8');
  const lines = raw.split(/\r?\n/);
  const next = lines.filter((line) => {
    const trimmed = line.trim();
    if (/^console\.(log|debug)\s*\(/.test(trimmed)) return false;
    if (/^}\s*if\s*\([^)]+\)\s*\{\s*console\.(log|debug)\s*\(/.test(trimmed)) {
      // Keep structural `}if (...) {` but drop inline console — handled below via replace
      return true;
    }
    return true;
  });
  let out = next.join('\n');
  // Only strip trailing inline console.log after `;` — never rewrite `}if` structures.
  out = out.replace(/;\s*console\.(log|debug)\([^;]*\);?/g, ';');
  out = out.replace(/\n{3,}/g, '\n\n');
  if (out !== raw) {
    fs.writeFileSync(file, out.endsWith('\n') ? out : `${out}\n`);
    changed += 1;
    console.error(`stripped: ${file}`);
  }
}
console.error(`done: ${changed} file(s)`);
