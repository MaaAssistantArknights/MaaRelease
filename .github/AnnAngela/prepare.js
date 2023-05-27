import console from "./console.js";
import fs from "fs";
import path from "path";
import readDir from "./readDir.js";
console.info("Copy upload-dir to the temp dir of runner...");
const tempUploadDirPath = path.join(process.env.RUNNER_TEMP, "upload-dir");
console.info("Remove unnecessary files...");
const uploadDir = await readDir(tempUploadDirPath);
const unnecessaryFiles = [];
for (const file of uploadDir) {
    const logFileName = path.relative(tempUploadDirPath, file);
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
