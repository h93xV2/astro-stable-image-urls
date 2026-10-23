# astro-stable-image-urls

An Astro integration that gives generated image assets content-derived filenames, so unchanged image bytes keep the same URL across builds.

## Install

```sh
npm install astro-stable-image-urls
```

## Configure

```js
// astro.config.mjs
import { defineConfig } from "astro/config";
import stableImageUrls from "astro-stable-image-urls";

export default defineConfig({
  integrations: [stableImageUrls()],
});
```

After a production build, the integration renames image files in `dist/_astro` using a SHA-256 digest of their emitted bytes, then updates references in generated HTML, CSS, JavaScript, JSON, and XML. Identical emitted image bytes produce the same filename across builds; changed bytes produce a new filename.

Astro copies files from `public/` without processing them, so those files keep their source filenames. This integration targets images emitted to `/_astro`.

## Notes

- The integration runs after production builds and does not change development URLs.
- It uses the output directory provided by Astro's `astro:build:done` hook.
- Keep prior generated files or redirects if external pages must continue serving old URLs after an image changes.
- Changes to image optimization or its options can change the emitted bytes and therefore the URL.

## Development

After cloning, run `bun install && bun run setup` to install dependencies and Git hooks.

## License

MIT
