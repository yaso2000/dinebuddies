# Gift shield PNG assets

Place your shield images in this folder. The profile **Gift shields** section loads them automatically.

## Current files

| Tier     | File           |
|----------|----------------|
| Bronze   | `Bronze.png`     |
| Silver   | `Silver.png`     |
| Gold     | `gold.png`       |
| Platinum | `Platinum.png`   |
| Diamond  | `Diamond.png`    |

Use **PNG with transparent background**.

## URLs

- `/gift-shields/Bronze.png`
- `/gift-shields/Silver.png`
- … etc.

Filenames are mapped in `src/constants/giftShieldVisualThemes.js` (`imageFile` per tier).

If a PNG fails to load, the app falls back to the built-in SVG shield.
