import { afterEach, describe, expect, it, mock } from "bun:test";
import { createHash } from "node:crypto";
import {
    mkdir,
    mkdtemp,
    readdir,
    readFile,
    rm,
    writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { AstroIntegrationLogger } from "astro";
import stableImageUrls from "../../src/index";

const temporaryDirectories: string[] = [];

async function createBuildDirectory() {
    const directory = await mkdtemp(
        path.join(os.tmpdir(), "astro-stable-image-urls-"),
    );
    temporaryDirectories.push(directory);
    await mkdir(path.join(directory, "_astro"));
    return directory;
}

async function runIntegration(directory: string) {
    const integration = stableImageUrls();
    const hook = integration.hooks["astro:build:done"];
    if (!hook || typeof hook !== "function")
        throw new Error("Build hook is missing");

    await hook({
        dir: pathToFileURL(`${directory}${path.sep}`),
        logger: { info: mock() } as unknown as AstroIntegrationLogger,
        pages: [],
        assets: new Map(),
    });
}

afterEach(async () => {
    await Promise.all(
        temporaryDirectories
            .splice(0)
            .map((directory) =>
                rm(directory, { recursive: true, force: true }),
            ),
    );
});

describe("astro-stable-image-urls", () => {
    it("renames images from their bytes and rewrites generated references", async () => {
        const directory = await createBuildDirectory();
        const imageBytes = Buffer.from("stable image bytes");
        const oldName = "hero.AstroBuildHash123.webp";
        const assetDirectory = path.join(directory, "_astro");
        await writeFile(path.join(assetDirectory, oldName), imageBytes);
        await writeFile(
            path.join(directory, "index.html"),
            `<img src="/_astro/${oldName}">`,
        );
        await writeFile(
            path.join(directory, "styles.css"),
            `url("/_astro/${oldName}")`,
        );

        await runIntegration(directory);

        const digest = createHash("sha256").update(imageBytes).digest("hex");
        const expectedName = `hero.${digest}.webp`;
        expect(await readdir(assetDirectory)).toEqual([expectedName]);
        expect(
            await readFile(path.join(directory, "index.html"), "utf8"),
        ).toContain(`/_astro/${expectedName}`);
        expect(
            await readFile(path.join(directory, "styles.css"), "utf8"),
        ).toContain(`/_astro/${expectedName}`);
    });

    it("produces the same URL for unchanged image bytes across builds", async () => {
        const firstBuild = await createBuildDirectory();
        const secondBuild = await createBuildDirectory();
        const imageBytes = Buffer.from("same image");
        await writeFile(
            path.join(firstBuild, "_astro", "photo.firstBuildHash.webp"),
            imageBytes,
        );
        await writeFile(
            path.join(secondBuild, "_astro", "photo.differentBuildHash.webp"),
            imageBytes,
        );

        await runIntegration(firstBuild);
        await runIntegration(secondBuild);

        expect(await readdir(path.join(firstBuild, "_astro"))).toEqual(
            await readdir(path.join(secondBuild, "_astro")),
        );
    });

    it("leaves public files untouched", async () => {
        const directory = await createBuildDirectory();
        await mkdir(path.join(directory, "images"));
        await writeFile(
            path.join(directory, "images", "public-image.png"),
            "bytes",
        );

        await runIntegration(directory);

        expect(await readdir(path.join(directory, "images"))).toEqual([
            "public-image.png",
        ]);
    });
});
