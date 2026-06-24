/**
 * Copies `community-chat-banner-templates/` (repo root) into
 * `public/community-chat-banner-templates/` for static hosting.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const src = path.join(root, 'community-chat-banner-templates');
const dest = path.join(root, 'public', 'community-chat-banner-templates');

if (!fs.existsSync(src)) {
    console.warn('[sync-community-banner-templates] Source folder missing:', src);
    process.exit(0);
}

fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.cpSync(src, dest, { recursive: true });
console.log('[sync-community-banner-templates] Copied to', dest);
