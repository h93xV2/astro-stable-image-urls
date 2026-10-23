import { expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const projectDirectory = fileURLToPath(new URL("../../", import.meta.url));
const bun = process.execPath;

function run(command: string, args: string[], cwd: string): string {
    const result = spawnSync(command, args, { cwd, encoding: "utf8" });
    if (result.status !== 0) {
        throw new Error(
            `${command} ${args.join(" ")} failed:\n${result.stdout}\n${result.stderr}`,
        );
    }
    return result.stdout;
}

test("imports the packed package and exposes an Astro build hook", () => {
    const directory = mkdtempSync(
        path.join(tmpdir(), "astro-stable-image-urls-"),
    );

    try {
        const packDirectory = path.join(directory, "pack");
        const unpackDirectory = path.join(directory, "unpack");
        mkdirSync(packDirectory);
        mkdirSync(unpackDirectory);

        const packOutput = run(
            bun,
            [
                "pm",
                "pack",
                "--ignore-scripts",
                "--destination",
                packDirectory,
                "--quiet",
            ],
            projectDirectory,
        );
        const tarballName = packOutput.trim();
        const tarball = path.isAbsolute(tarballName)
            ? tarballName
            : path.join(packDirectory, tarballName);
        run("tar", ["-xzf", tarball, "-C", unpackDirectory], projectDirectory);

        const entryPoint = pathToFileURL(
            path.join(unpackDirectory, "package", "dist", "index.js"),
        ).href;
        const output = run(
            "node",
            [
                "--input-type=module",
                "--eval",
                `
                    import assert from "node:assert/strict";
                    import stableImageUrls from ${JSON.stringify(entryPoint)};
                    const integration = stableImageUrls();
                    assert.equal(integration.name, "astro-stable-image-urls");
                    assert.equal(typeof integration.hooks["astro:build:done"], "function");
                `,
            ],
            projectDirectory,
        );

        expect(output).toBe("");
    } finally {
        rmSync(directory, { force: true, recursive: true });
    }
});
