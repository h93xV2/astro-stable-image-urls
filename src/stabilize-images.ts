import { createHash } from "node:crypto";
import { readdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { AstroIntegrationLogger } from "astro";
import { IMAGE_EXTENSIONS, REFERENCE_EXTENSIONS } from "./file-extensions.js";

async function walk(directory: string): Promise<string[]> {
    const entries = await readdir(directory, { withFileTypes: true });
    const files: string[] = [];
    for (const entry of entries) {
        const filePath = path.join(directory, entry.name);
        if (entry.isDirectory()) files.push(...(await walk(filePath)));
        else files.push(filePath);
    }
    return files;
}

function stableName(name: string, content: Buffer): string {
    const extension = path.extname(name).toLowerCase();
    const baseName = path.basename(name, path.extname(name));
    const readableName =
        baseName.replace(/\.[A-Za-z0-9_-]{8,}$/, "") || baseName;
    const digest = createHash("sha256").update(content).digest("hex");
    return `${readableName}.${digest}${extension}`;
}

export async function stabilizeImages(
    outputDirectory: string,
    logger: Pick<AstroIntegrationLogger, "info">,
): Promise<void> {
    const astroDirectory = path.join(outputDirectory, "_astro");
    const files = await walk(outputDirectory);
    const replacements = new Map<string, string>();

    for (const filePath of files) {
        if (path.dirname(filePath) !== astroDirectory) continue;
        const oldName = path.basename(filePath);
        if (!IMAGE_EXTENSIONS.has(path.extname(oldName).toLowerCase()))
            continue;
        const newName = stableName(oldName, await readFile(filePath));
        if (newName === oldName) continue;
        await rename(filePath, path.join(astroDirectory, newName));
        replacements.set(oldName, newName);
    }

    for (const filePath of files) {
        if (path.dirname(filePath) === astroDirectory) continue;
        if (!REFERENCE_EXTENSIONS.has(path.extname(filePath).toLowerCase()))
            continue;
        let content = await readFile(filePath, "utf8");
        let changed = false;
        for (const [oldName, newName] of replacements) {
            if (!content.includes(oldName)) continue;
            content = content.replaceAll(oldName, newName);
            changed = true;
        }
        if (changed) await writeFile(filePath, content, "utf8");
    }

    logger.info(
        `Renamed ${replacements.size} image assets to content-derived URLs.`,
    );
}
