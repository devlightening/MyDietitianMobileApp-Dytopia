# Favicon Placeholder

## Instructions

Please add a favicon to this location:
`web-panel/public/favicon.ico`

### Recommended Design:
- **Size:** 32x32 pixels (or 16x16)
- **Format:** .ico or .png
- **Design:** Simple leaf icon in sage green (#4A7C59)
- **Style:** Minimalist, modern, representing health and nature

### Quick Options:

1. **Use an online favicon generator:**
   - https://favicon.io/
   - https://realfavicongenerator.net/

2. **Use an emoji as favicon:**
   ```html
   <!-- Add to app/layout.tsx metadata -->
   export const metadata = {
     icons: { icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🥗</text></svg>" }
   }
   ```

3. **Simple SVG favicon:**
   Create `public/favicon.svg` with a simple leaf design

### Current Status:
- ❌ Favicon not yet created (image generation service unavailable)
- ✅ Path configured correctly in Next.js
- ✅ Will work once file is added

Once you add the favicon file, restart the Next.js dev server to see it take effect.
