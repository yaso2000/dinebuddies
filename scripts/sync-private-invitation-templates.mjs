/**
 * Copies `private-invitation-templates/` (repo root) into `public/private-invitation-templates/`
 * so Vite and static hosts serve them at /private-invitation-templates/...
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const src = path.join(root, 'private-invitation-templates');
const dest = path.join(root, 'public', 'private-invitation-templates');

if (!fs.existsSync(src)) {
    console.warn('[sync-private-templates] Source folder missing:', src);
    process.exit(0);
}

fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.cpSync(src, dest, { recursive: true });
console.log('[sync-private-templates] Copied to', dest);
