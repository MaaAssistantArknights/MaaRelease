import console from "../modules/console.js";
import fs from "node:fs";
import readDir from "../modules/readDir.js";
import path from "node:path";
const uploadDirPath = process.env.dirWithReleaseTag;
console.info("uploadDirPath:", uploadDirPath);
console.info("Remove unnecessary files...");
const uploadDir = await readDir(uploadDirPath);
const unnecessaryFiles = [];
for (const file of uploadDir) {
    const logFileName = path.relative(uploadDirPath, file);
    if (!file.includes("/MAAComponent-OTA-v")) {
        console.info("⛔️", logFileName, "Not ota file, mark as unnecessary.");
        unnecessaryFiles.push(file);
        await fs.promises.rm(file, { force: true });
        continue;
    }
    try {
        const filename = path.basename(file);
        const [, before, after] = filename.match(/(?<=MAAComponent-OTA-v)(\d+(?:\.\d+)*)(?:-[^-_]+)?_v(\d+(?:\.\d+)*)(?=-)/);
        const [beforeMajor, beforeMinor] = before.match(/\d+/g);
        const [afterMajor, afterMinor] = after.match(/\d+/g);
        if (beforeMajor !== afterMajor) {
            console.info("✔️", logFileName, "Different major version numbers, mark as necessary.");
            continue;
        }
        if (+afterMinor - +beforeMinor <= 3) {
            console.info("✔️", logFileName, "Minor version numbers differ by no more than 3, mark as necessary.");
            continue;
        }
        console.error("⛔️", logFileName, "Minor version numbers differ by more than 3, mark as unnecessary.");
        unnecessaryFiles.push(file);
        await fs.promises.rm(file, { force: true });
        continue;
    } catch (e) {
        console.error("⛔️", logFileName, "Mark as unnecessary:", e);
        unnecessaryFiles.push(file);
        await fs.promises.rm(file, { force: true });
        continue;
    }
}
console.info("Deleted:", unnecessaryFiles);
console.info("Done.");
