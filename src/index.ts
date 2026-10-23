import type { AstroIntegration } from "astro";
import { fileURLToPath } from "node:url";
import { stabilizeImages } from "./stabilize-images.js";

export default function stableImageUrls(): AstroIntegration {
    return {
        name: "astro-stable-image-urls",
        hooks: {
            "astro:build:done": async ({ dir, logger }) => {
                await stabilizeImages(fileURLToPath(dir), logger);
            },
        },
    };
}
