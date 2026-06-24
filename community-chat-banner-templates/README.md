# Community chat banner templates

Static and loop media for business community chat banner backgrounds (16:9).

## Layout

- `images/` — still backgrounds (`.webp`, `.jpg`, `.png`)
- `videos/` — loop backgrounds (`.mp4`, `.webm`), muted autoplay in banner

## Adding templates

1. Drop assets into `images/` or `videos/`.
2. Register each entry in `src/data/communityBannerTemplates.manifest.json`.
3. Run `npm run sync:community-banner-templates` (also runs on `npm run build`).

Assets are copied to `public/community-chat-banner-templates/` for hosting.
