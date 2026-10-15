# Helping Hands visual assets

All page images are local so the website does not depend on remote image requests at runtime.
The supplied screenshots guided composition, palette, and the community illustration; they are not embedded as page screenshots.

## Hero illustration
- Tool: built-in image generation (not the CLI).
- Original: `public/images/community-hero.png`
- Web-optimized transparent derivative: `public/images/community-hero.webp` (477,284 bytes, approximately 81% smaller).
- Both the landing hero and account pages use the WebP.
- `scripts/optimize-hero.mjs` re-encodes the original without changing composition.
- Original generation is an illustration, not a photograph or claim about actual beneficiaries.

### Exact generation prompt

Use case: illustration-story. Asset type: standalone transparent hero illustration for an Indian charity website, Helping Hands. Create a sophisticated hand-drawn editorial illustration of an Indian community coming together: left a young woman volunteer in a burgundy kurta kneels and shares an open book with a smiling schoolgirl in a blue uniform; center a young man in a muted teal shirt carrying a small stack of books, with a schoolboy nearby; right another volunteer in a terracotta shirt kneels planting a small leafy sapling. Behind them, subtle distant pale pink community school facade, a few delicate sage green botanical branches. Composition: a single cohesive natural wide scene, all figures visible, full figures, grounded at bottom, generous breathing space at top; landscape 3:2 composition, clean cutout on genuinely transparent background, no rectangular backdrop. Style: premium contemporary editorial illustration, beautifully drawn faces, delicate ink contours, matte gouache color, restrained realistic proportions, subtle paper texture in painted areas. Palette: rich burgundy #861a45, rose pink, warm cream, muted teal, sage green, natural warm brown skin tones. Mood: optimistic, human, warm. No text, no typography, no logos, no UI, no cards, no icons, no gradients, no glossy 3D, no anime. The image will sit on a pale blush background next to a large headline.

## Category and volunteer photographs

Photos are illustrative; the homepage identifies them as such. They are not presented as photographs of the API campaign records.

| Local file | Source |
| --- | --- |
| `public/images/education.jpg` | [Swastik Arora, Pexels](https://www.pexels.com/photo/children-sitting-in-a-classroom-with-desks-and-chairs-18012456/) |
| `public/images/healthcare.jpg` | [Pexels photo 7579831](https://www.pexels.com/photo/7579831/) |
| `public/images/environment.jpg` | [Unsplash original](https://images.unsplash.com/photo-1416879595882-3373a0480b5b) |
| `public/images/food.jpg` | [Joel Muniz, Unsplash](https://unsplash.com/photos/people-packing-food-in-plastic-bags-qvzjG2pF4bE) |
| `public/images/volunteer.jpg` | [Unsplash original](https://images.unsplash.com/photo-1593113598332-cd288d649433) |

The heart mark is a small code-native SVG in `src/ui/Logo.tsx` and `public/favicon.svg`.
Fonts are self-hosted through the existing Fontsource packages.

