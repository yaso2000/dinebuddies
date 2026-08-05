# Personal invitation templates (source)

Copied into `public/private-invitation-templates/` by:

```bash
npm run sync:private-templates
```

Place background files under **category subfolders**:

```
backgrounds/
  dating/       ← romantic / one-on-one templates (current set)
  friendship/   ← add new files here
  icebreaker/   ← add new files here
```

Use the template **file stem** as the filename (see `src/components/Invitations/privateCard/privateCardBackgrounds.js`).
Example: `dating-luxury-floral.webp` in `backgrounds/dating/`.
