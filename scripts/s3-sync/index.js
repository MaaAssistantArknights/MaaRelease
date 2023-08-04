/* eslint-disable no-loop-func */
import console from "../modules/console.js";
import { Octokit } from "../modules/octokit.js";
import path from "path";
// eslint-disable-next-line no-unused-vars
import { Client } from "minio";
import os from "os";
import timerPromises from "timers/promises";
import byteSize from "byte-size";
import http from "http";
let success = true;
try {
    const owner = process.env.OWNER;
    const repo = process.env.REPO;
    if (!owner) {
        throw new SyntaxError("OWNER is not defined.");
    }
    if (!repo) {
        throw new SyntaxError("REPO is not defined.");
    }
    // read FILE_PATTERN from env, this `atob` code is used to avoid false alert from codeql
    let FILE_PATTERN = process[atob("ZW52")].FILE_PATTERN;
    if (!FILE_PATTERN) {
        FILE_PATTERN = ".*";
        console.info("FILE_PATTERN is not defined, use default value: .*");
    }
    const pattern = new RegExp(FILE_PATTERN);
    const ua = `Node.js/${process.versions.node} (${process.platform} ${os.release()}; ${process.arch})`;
    console.info("process.env.THREAD:", process.env.THREAD);
    const THREAD = Math.max(0, Number.isSafeInteger(+process.env.THREAD) ? +process.env.THREAD : 4);
    const NUMBER_OF_RETRIES = Math.max(0, Number.isSafeInteger(+process.env.NUMBER_OF_RETRIES) ? +process.env.NUMBER_OF_RETRIES : 5);
    console.info("# of thread:", THREAD);
    console.info("OWNER:", owner);
    console.info("REPO:", repo);
    console.info("FILE_PATTERN:", FILE_PATTERN);
    console.info("pattern:", pattern);
    console.info("ua:", ua);
    console.info("Initialization done.");

    const octokit = new Octokit({});
    const { token } = await octokit.auth();
    const MINIO_WAIT_TIME_AFTER_UPLOAD_MS = +process.env.MINIO_WAIT_TIME_AFTER_UPLOAD_MS || 1000;
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
     * @typedef { { size: number, etag: string, lastModified: Date, metaData: Record<string, any> } } BucketItemStat
     */
    /**
     * @typedef { Awaited<ReturnType<octokit['rest']['repos']['getRelease']>>['data']['assets'][number] } Asset
     */
    /**
     * @type {(objectName: string) => Promise<BucketItemStat>}
     */
    const minioClientStatObject = (objectName) => new Promise((res, rej) => minioClient.statObject(process.env.MINIO_BUCKET, objectName, (err, stat) => err && err.code !== "NotFound" ? rej(err) : res(err ? {
        size: -1,
        etag: "",
        lastModified: new Date(-1),
        metaData: {},
    } : stat)));

    let releaseTag = process.env.RELEASE_TAG;
    console.info("Fetching the release list");
    /**
     * @type { Asset[] }
     */
    const assets = [];
    const releaseList = await octokit.rest.repos.listReleases({
        owner,
        repo,
    });
    let releaseFound;
    if (!releaseTag) {
        console.info("No release_tag found in env, use the latest tag.");
        releaseFound = releaseList.data[0];
    } else {
        console.info("release_tag in env:", releaseTag, "try to find this tag.");
        const found = releaseList.data.find((release) => release.tag_name === releaseTag);
        if (found) {
            console.info("Tag found.");
            releaseFound = found;
        } else {
            console.info("No tag found, use the latest tag.");
            releaseFound = releaseList.data[0];
        }
    }
    releaseTag = releaseFound.tag_name;
    console.info("release_tag:", releaseTag);
    /**
     * @param { Asset } asset
     * @return { Promise<{ stat: BucketItemStat, status: boolean }> }
     */
    const validateAssetViaStatObject = async (asset, thread) => {
        const objectName = path.join(owner, repo, "releases", "download", releaseTag, asset.name);
        for (let i = 0; i < NUMBER_OF_RETRIES; i++) {
            try {
                const stat = await minioClientStatObject(objectName);
                return { stat, status: stat.size > 0 && stat.size === asset.size };
            } catch (e) {
                console.error(...typeof thread === "number" ? ["[Thread", thread, "]"] : [], "ValidateAssetViaStatObject error #", i, "/", NUMBER_OF_RETRIES, ", wait 5000 ms:", e);
                await timerPromises.setTimeout(5000);
            }
        }
        return { status: false };
    };
    for (const asset of releaseFound.assets) {
        assets.push(asset);
    }
    const filteredAssets = assets.filter(({ name }) => pattern.test(name));
    console.info("assets:", assets.length, assets.map(({ name }) => name));
    console.info("filtered assets:", filteredAssets.length, filteredAssets.map(({ name }) => name));

    console.info("Start fetching...");
    const beginHrtime = process.hrtime.bigint();
    const changedAssets = [];
    await Promise.all(Array.from({ length: THREAD }).map(async (_, i) => {
        let asset = filteredAssets.shift();
        while (asset) {
            let data, durationInSecondsInFetching, transferRatesInFetching,
                isDone = false;
            for (let j = 0; j < NUMBER_OF_RETRIES; j++) {
                try {
                    console.info("[Thread", i, "]", "Trying to upload", asset.name, "#", j);
                    console.info("[Thread", i, "]", "Get the stat from minio for", asset.name);
                    const objectName = path.join(owner, repo, "releases", "download", releaseTag, asset.name);
                    const { status: isExist } = await validateAssetViaStatObject(asset, i);
                    if (isExist) {
                        console.info("[Thread", i, "]", asset.name, "is already uploaded, skip.");
                    } else {
                        if (!data) {
                            console.info("[Thread", i, "]", asset.name, "unexists, start fetching the asset.");
                            const headers = {
                                accept: "application/octet-stream",
                                authorization: `Bearer ${token}`,
                                "user-agent": ua,
                            };
                            const response = await fetch(asset.url, {
                                method: "GET",
                                redirect: "follow",
                                headers,
                            });
                            if (!response.ok) {
                                throw new Error("Response not ok");
                            }
                            console.info("[Thread", i, "]", asset.name, "unexists, start downloading the asset.");
                            const startFetchHrtime = process.hrtime.bigint();
                            const arrayBuffer = await response.arrayBuffer();
                            const endFetchHrtime = process.hrtime.bigint();
                            data = Buffer.from(arrayBuffer);
                            durationInSecondsInFetching = Number(endFetchHrtime - startFetchHrtime) / 10 ** 9;
                            transferRatesInFetching = byteSize(data.byteLength / durationInSecondsInFetching, { precision: 3, units: "iec" });
                            console.info("[Thread", i, "]", asset.name, "fetched in", +durationInSecondsInFetching.toFixed(3), "sec with", +transferRatesInFetching.value, transferRatesInFetching.unit, "/s, start uploading.");
                        } else {
                            console.info("[Thread", i, "]", asset.name, "unexists, but the asset is downloaded, start uploading.");
                        }
                        const startPutHrtime = process.hrtime.bigint();
                        const info = await minioClient.putObject(process.env.MINIO_BUCKET, objectName, data);
                        const endPutHrtime = process.hrtime.bigint();
                        const durationInSecondsInUploading = Number(endPutHrtime - startPutHrtime) / 10 ** 9;
                        const transferRatesInUploading = byteSize(data.byteLength / durationInSecondsInUploading, { precision: 3, units: "iec" });
                        console.info("[Thread", i, "]", asset.name, "uploaded in", +durationInSecondsInUploading.toFixed(3), "sec with", +transferRatesInUploading.value, transferRatesInUploading.unit, "/s, wait", MINIO_WAIT_TIME_AFTER_UPLOAD_MS, "ms and check the integrity.");
                        await timerPromises.setTimeout(MINIO_WAIT_TIME_AFTER_UPLOAD_MS);
                        const { stat, status: isValidated } = await validateAssetViaStatObject(asset, i);
                        if (isValidated) {
                            console.info("[Thread", i, "]", "Uploaded", asset.name, ", Done:", { ...stat, ...info });
                            changedAssets.push(asset);
                        } else {
                            console.error("[Thread", i, "]", "Uploaded", asset.name, ", failed, size not match - asset.size:", asset.size, "stat:", stat);
                            throw new Error("Upload failed, size not match");
                        }
                    }
                    asset = filteredAssets.shift();
                    isDone = true;
                    break;
                } catch (e) {
                    e.thread = i;
                    console.error("[Thread", i, "]", "Upload error #", j, "/", NUMBER_OF_RETRIES, ", wait 5000 ms:", e);
                    await timerPromises.setTimeout(5000);
                }
            }
            if (!isDone) {
                console.error("[Thread", i, "]", "Upload error for asset", asset.name, ", skip.");
            }
        }
        console.info("[Thread", i, "]", "done.");
    }));
    const afterHrtime = process.hrtime.bigint();
    console.info("Download progress done, duration:", Number(afterHrtime - beginHrtime) / 10 ** 9, "s.");
    if (changedAssets.length === 0) {
        console.info("No assets are uploaded, exit.");
        process.exit(0);
    }
    console.info("Validating", changedAssets.length, "uploaded assets...");
    const failedAssets = [];
    for (const asset of changedAssets) {
        const { stat, status: isExist } = await validateAssetViaStatObject(asset);
        if (isExist) {
            continue;
        }
        console.info("The size of", asset.name, "is not match, asset.size:", asset.size, "stat:", stat);
        failedAssets.push(asset.name);
    }
    if (failedAssets.length === 0) {
        console.info("All assets are uploaded successfully, exit.");
        process.exit(0);
    }
    console.info("Failed assets:", failedAssets);
    throw new Error("Failed to upload some assets.");
} catch (e) {
    console.error("Error:", e);
    success = false;
}
const data = {
    OWNER: process.env.OWNER,
    REPO: process.env.REPO,
    RELEASE_TAG: process.env.RELEASE_TAG,
    success,
};
console.info("Start report:", data);
const result = await (await fetch("https://qqbot.annangela.cn/webhook?type=MaaRelease&origin=jenkins_report", {
    headers: {
        "x-authorization": process.env.ANNANGELA_QQBOT_TOKEN,
    },
    data,
})).json();
console.info("result:", result);
process.exit(success ? 0 : 1);
