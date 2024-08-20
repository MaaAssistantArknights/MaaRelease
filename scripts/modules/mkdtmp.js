import console from "../modules/console.js";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * @param { { local?: boolean, random?: boolean, subDir?: string } } [options]
 */
export default async (options = {}) => {
    const local = typeof options.local === "boolean" ? options.local : false;
    const random = typeof options.random === "boolean" ? options.random : true;
    const subDir = typeof options.subDir === "string" ? options.subDir : random ? randomUUID() : "MaaRelease";
    const tempPath = join(local ? ".tmp" : tmpdir(), subDir);
    console.log("tempPath:", tempPath);
    await fs.promises.mkdir(tempPath, {
        recursive: true,
    });
    return tempPath;
};
