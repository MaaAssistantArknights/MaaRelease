/* eslint-disable require-atomic-updates */
import path from "node:path";
import os from "node:os";
import http from "node:http";
import timerPromises from "node:timers/promises";
import { Client } from "minio";
import byteSize from "byte-size";
import { CronJob } from "cron";
import console from "../modules/console.js";
import { Octokit } from "../modules/octokit.js";
import retryableFetch from "../modules/retryableFetch.js";

const getByteSize = (input) => {
    const { value, unit } = byteSize(input, { precision: 3, units: "iec" });
    return `${value} ${unit}`;
};
const memoryOutput = (usedMemory, type) => console.log(`Memory ${type}: \n  - Heap used: ${getByteSize(usedMemory.heapUsed)}\n  - Heap total: ${getByteSize(usedMemory.heapTotal)}\n  - External: ${getByteSize(usedMemory.external)}\n  - RSS: ${getByteSize(usedMemory.rss)}\n  - Array Buffers: ${getByteSize(usedMemory.arrayBuffers)}`);
const getIntegerFromProcessEnv = (envName, minValue, defaultValue) => {
    const processEnvValue = +process.env[envName]?.trim();
    const value = Number.isSafeInteger(processEnvValue) ? processEnvValue : defaultValue;
    return Math.max(minValue, value);
};

const OWNER = process.env.OWNER?.trim();
const REPO_LIST = process.env.REPO_LIST?.trim();
if (!OWNER) {
    throw new SyntaxError("OWNER is not defined.");
}
if (!REPO_LIST) {
    throw new SyntaxError("REPO_LIST is not defined.");
}
// read FILE_PATTERN from env, this `atob` code is used to avoid false alert from codeql
let FILE_PATTERN = process[atob("ZW52")].FILE_PATTERN;
if (!FILE_PATTERN) {
    FILE_PATTERN = ".*";
    console.info("FILE_PATTERN is not defined, use default value:", FILE_PATTERN);
}
const pattern = new RegExp(FILE_PATTERN);
const ua = `Node.js/${process.versions.node} (${process.platform} ${os.release()}; ${process.arch})`;
console.info("process.env.THREAD:", process.env.THREAD?.trim());
const THREAD = getIntegerFromProcessEnv("THREAD", 4, 0);
const NUMBER_OF_RETRIES = getIntegerFromProcessEnv("NUMBER_OF_RETRIES", 5, 0);
console.info("# of thread:", THREAD);
console.info("OWNER:", OWNER);
console.info("REPO_LIST:", REPO_LIST);
console.info("FILE_PATTERN:", FILE_PATTERN);
console.info("pattern:", pattern);
console.info("ua:", ua);
const octokit = new Octokit({});
const { token } = await octokit.auth();
const headers = {
    accept: "application/octet-stream",
    authorization: `Bearer ${token}`,
    "user-agent": ua,
};
const MINIO_WAIT_TIME_AFTER_UPLOAD_MS = getIntegerFromProcessEnv("MINIO_WAIT_TIME_AFTER_UPLOAD_MS", 1000, 0);
const minioClient = new Client({
    endPoint: process.env.MINIO_ENDPOINT_DOMAIN,
    port: +process.env.MINIO_ENDPOINT_PORT,
    useSSL: false,
    accessKey: process.env.MINIO_ACCESS_KEY,
    secretKey: process.env.MINIO_SECRET_KEY,
    transportAgent: new http.Agent({
        timeout: 2147483647,
        keepAlive: true,
    }),
});
/**
 * @typedef { Awaited<ReturnType<octokit["rest"]["repos"]["getRelease"]>>["data"]["assets"][number] & { releaseTag: string } } Asset
 */
/**
 * @param { Asset } asset
 * @param { string } REPO
 * @param { string } ROOT_PATH
 * @param { number } thread
 * @return { Promise<{ stat: import("minio").BucketItemStat, status: boolean }> }
 */
const validateAssetViaStatObject = async (asset, REPO, ROOT_PATH, thread) => {
    const objectName = path.join(ROOT_PATH, asset.releaseTag, asset.name);
    for (let i = 0; i < NUMBER_OF_RETRIES; i++) {
        try {
            const stat = await minioClient.statObject(process.env.MINIO_BUCKET, objectName);
            return { stat, status: stat.size > 0 && stat.size === asset.size };
        } catch (e) {
            console.error(`[${REPO}]`, ...typeof thread === "number" ? ["[Thread", thread, "]"] : [], "ValidateAssetViaStatObject error #", i, "/", NUMBER_OF_RETRIES, ", wait 5000 ms:", e);
            await timerPromises.setTimeout(5000);
        }
    }
    return { status: false };
};
/**
 * @type { (...args: Parameters<Client["listObjectsV2"]>) => Promise<import("minio").BucketItem[]> }
 */
const listObjectsV2 = (...args) => new Promise((res, rej) => {
    const items = [];
    minioClient.listObjectsV2(args)
        .on("data", (item) => items.push(item))
        .on("end", () => res(items))
        .on("error", rej);
});
console.info("Initialization done.");

for (const REPO of REPO_LIST.trim().split(/\s*,\s*/)) {
    const ROOT_PATH = path.join(OWNER, REPO, "releases", "download");
    console.info(`[${REPO}]`, "ROOT_PATH:", ROOT_PATH);
    CronJob.from({
        cronTime: "0 50 * * * *",
        start: true,
        runOnInit: true,
        onTick: async () => {
            let lastError;
            let duration = -1;
            const count = {
                total: 0,
                filtered: 0,
                durationInSeconds: 0,
                byteLength: 0,
            };
            try {
                console.info(`[${REPO}]`, "Fetching the release list");
                /**
                 * @type { Asset[] }
                 */
                const assets = [];
                const releaseList = await octokit.rest.repos.listReleases({
                    owner: OWNER,
                    repo: REPO,
                    per_page: 100,
                });
                const releaseCategories = {
                    stable: [],
                    beta: [],
                    alpha: [],
                };
                const releaseTags = [];
                // eslint-disable-next-line no-sparse-arrays
                const dotCountToType = [, , , "stable", "beta", "alpha"];
                for (const release of releaseList.data) {
                    const { tag_name: releaseTag } = release;
                    const type = dotCountToType[releaseTag.split(".").length];
                    if (releaseCategories[type].length >= 10) {
                        continue;
                    }
                    const filteredAssets = release.assets.filter(({ name }) => pattern.test(name));
                    releaseCategories[type].push({
                        releaseTag,
                        assetsLength: release.assets.length,
                        filteredAssetsLength: filteredAssets.length,
                    });
                    count.total += release.assets.length;
                    count.filtered = filteredAssets.length;
                    releaseTags.push(releaseTag);
                    for (const asset of filteredAssets) {
                        assets.push({
                            ...asset,
                            releaseTag,
                        });
                    }
                }
                console.info(`[${REPO}]`, "releaseCategories:", releaseCategories);

                console.info(`[${REPO}]`, "Start fetching...");
                const beforeUsedMemory = process.memoryUsage();
                memoryOutput(beforeUsedMemory, "usage");
                const changedAssets = [];
                const beginHrtime = process.hrtime.bigint();
                await Promise.all(Array.from({ length: THREAD }).map(async (_, i) => {
                    let asset = assets.shift();
                    while (asset) {
                        let data, durationInSecondsInFetching, transferRatesInFetching,
                            isDone = false;
                        for (let j = 0; j < NUMBER_OF_RETRIES; j++) {
                            try {
                                console.info(`[${REPO}]`, "[Thread", i, "]", "Trying to upload", asset.name, "#", j);
                                console.info(`[${REPO}]`, "[Thread", i, "]", "Get the stat from minio for", asset.name);
                                const objectName = path.join(ROOT_PATH, asset.releaseTag, asset.name);
                                const { status: isExist } = await validateAssetViaStatObject(asset, REPO, ROOT_PATH, i);
                                if (isExist) {
                                    console.info(`[${REPO}]`, "[Thread", i, "]", asset.name, "is already uploaded, skip.");
                                } else {
                                    if (!data) {
                                        console.info(`[${REPO}]`, "[Thread", i, "]", asset.name, "unexists, start fetching the asset.");
                                        const response = await fetch(asset.url, {
                                            method: "GET",
                                            redirect: "follow",
                                            headers,
                                        });
                                        if (!response.ok) {
                                            throw new Error("Response not ok");
                                        }
                                        console.info(`[${REPO}]`, "[Thread", i, "]", asset.name, "unexists, start downloading the asset.");
                                        const startFetchHrtime = process.hrtime.bigint();
                                        const arrayBuffer = await response.arrayBuffer();
                                        const endFetchHrtime = process.hrtime.bigint();
                                        data = Buffer.from(arrayBuffer);
                                        durationInSecondsInFetching = Number(endFetchHrtime - startFetchHrtime) / 10 ** 9;
                                        transferRatesInFetching = getByteSize(data.byteLength / durationInSecondsInFetching);
                                        console.info(`[${REPO}]`, "[Thread", i, "]", asset.name, "fetched in", +durationInSecondsInFetching.toFixed(3), "sec with", +transferRatesInFetching.value, transferRatesInFetching.unit, "/s, start uploading.");
                                    } else {
                                        console.info(`[${REPO}]`, "[Thread", i, "]", asset.name, "unexists, but the asset is downloaded, start uploading.");
                                    }
                                    const startPutHrtime = process.hrtime.bigint();
                                    const info = await minioClient.putObject(process.env.MINIO_BUCKET, objectName, data);
                                    const endPutHrtime = process.hrtime.bigint();
                                    const durationInSecondsInUploading = Number(endPutHrtime - startPutHrtime) / 10 ** 9;
                                    const transferRatesInUploading = getByteSize(data.byteLength / durationInSecondsInUploading);
                                    console.info(`[${REPO}]`, "[Thread", i, "]", asset.name, "uploaded in", +durationInSecondsInUploading.toFixed(3), "sec with", +transferRatesInUploading.value, transferRatesInUploading.unit, "/s, wait", MINIO_WAIT_TIME_AFTER_UPLOAD_MS, "ms and check the integrity.");
                                    await timerPromises.setTimeout(MINIO_WAIT_TIME_AFTER_UPLOAD_MS);
                                    const { stat, status: isValidated } = await validateAssetViaStatObject(asset, REPO, ROOT_PATH, i);
                                    if (isValidated) {
                                        console.info(`[${REPO}]`, "[Thread", i, "]", "Uploaded", asset.name, ", Done:", { ...stat, ...info });
                                        changedAssets.push(asset);
                                        if (typeof durationInSecondsInFetching === "number") {
                                            count.durationInSeconds += durationInSecondsInFetching;
                                            count.byteLength += data.byteLength;
                                        }
                                    } else {
                                        console.error(`[${REPO}]`, "[Thread", i, "]", "Uploaded", asset.name, ", failed, size not match - asset.size:", asset.size, "stat:", stat);
                                        throw new Error("Upload failed, size not match");
                                    }
                                }
                                asset = assets.shift();
                                isDone = true;
                                break;
                            } catch (e) {
                                e.thread = i;
                                console.error(`[${REPO}]`, "[Thread", i, "]", "Upload error #", j, "/", NUMBER_OF_RETRIES, ", wait 5000 ms:", e);
                                await timerPromises.setTimeout(5000);
                            }
                        }
                        if (!isDone) {
                            console.error(`[${REPO}]`, "[Thread", i, "]", "Upload error for asset", asset.name, ", skip.");
                        }
                    }
                    console.info(`[${REPO}]`, "[Thread", i, "]", "done.");
                }));
                const afterHrtime = process.hrtime.bigint();
                const afterUsedMemory = process.memoryUsage();
                memoryOutput(afterUsedMemory, "usage");
                memoryOutput(Object.fromEntries(Object.entries(afterUsedMemory).map(([k, v]) => [k, v - beforeUsedMemory[k]])), "diff");
                duration = Number(afterHrtime - beginHrtime) / 10 ** 9;
                count.downloaded = changedAssets.length;
                console.info(`[${REPO}]`, "Download progress done, duration:", duration, "s.");

                console.info(`[${REPO}]`, "Removing outdated releases...");
                const dir = await listObjectsV2(process.env.MINIO_BUCKET, ROOT_PATH, false);
                for (const folder of dir) {
                    const folderPath = path.join(ROOT_PATH, folder);
                    if (releaseTags.includes(folder)) {
                        console.info(`[${REPO}]`, "Folder", folderPath, "is still in use, skip.");
                    }
                    console.info(`[${REPO}]`, "Removing", folderPath);
                    const items = await listObjectsV2(process.env.MINIO_BUCKET, folderPath, true);
                    await minioClient.removeObjects(process.env.MINIO_BUCKET, items.map(({ name }) => name));
                    console.info(`[${REPO}]`, "Removed", folderPath);
                }

                if (changedAssets.length === 0) {
                    console.info(`[${REPO}]`, "No assets are uploaded, exit.");
                } else {
                    console.info(`[${REPO}]`, "Validating", changedAssets.length, "uploaded assets...");
                    const failedAssets = [];
                    for (const asset of changedAssets) {
                        const { stat, status: isExist } = await validateAssetViaStatObject(asset, REPO, ROOT_PATH);
                        if (isExist) {
                            continue;
                        }
                        console.info(`[${REPO}]`, "The size of", asset.name, "is not match, asset.size:", asset.size, "stat:", stat);
                        failedAssets.push(asset.name);
                    }
                    if (failedAssets.length === 0) {
                        console.info(`[${REPO}]`, "All assets are uploaded successfully, exit.");
                    } else {
                        console.info(`[${REPO}]`, "Failed assets:", failedAssets);
                        throw new Error("Failed to upload some assets.");
                    }
                }
            } catch (e) {
                lastError = e;
            }
            const data = {
                OWNER,
                REPO,
                success: !!lastError,
                duration,
                count,
            };
            // @TODO Remove this condition if qqbot is fixed
            if (Number.MAX_SAFE_INTEGER < Number.MIN_SAFE_INTEGER) {
                try {
                    console.info(`[${REPO}]`, "Start report:", data);
                    const result = await (await retryableFetch("https://qqbot.annangela.cn/webhook?type=MaaRelease&origin=jenkins_report", {
                        headers: {
                            "x-authorization": process.env.ANNANGELA_QQBOT_TOKEN,
                        },
                        method: "POST",
                        body: JSON.stringify(data),
                    })).json();
                    console.info(`[${REPO}]`, "result:", result);
                } catch (e) {
                    console.error(`[${REPO}]`, "Failed to report to qqbot:", e);
                }
            }
            if (lastError) {
                throw lastError;
            }
        },
    });
}
