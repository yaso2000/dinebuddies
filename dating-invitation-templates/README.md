# Dating invitation templates

Portrait card backgrounds for **dating** invitations only. These assets are **not** shared with private-invitation templates under `public/invitation-card-backgrounds/`.

## Layout

- Put background images in `backgrounds/` using the **file stem** listed in `src/components/Invitations/datingCard/datingCardBackgrounds.js` (e.g. `dating-rose.webp`, `dating-rose.jpg`, or `dating-rose.svg`).
- Supported extensions are tried in order: optional per-option `ext`, then `webp`, `jpg`, `jpeg`, `png`.

## Serving in the app

Run:

```bash
npm run sync:dating-templates
```

This copies this folder into `public/dating-invitation-templates/` (also runs automatically before `npm run build`).

After adding or changing files here, sync again (or rebuild) so the dev server and production build pick them up.
