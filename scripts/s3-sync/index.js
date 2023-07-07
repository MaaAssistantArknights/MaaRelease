/* eslint-disable no-loop-func */
import { Octokit } from "../modules/octokit.js";
import path from "path";
import console from "../modules/console.js";
// eslint-disable-next-line no-unused-vars
import { Client } from "minio";
import http2 from "http2";
import os from "os";
import timerPromises from "timers/promises";
import byteSize from "byte-size";
const OWNER = process.env.OWNER || "MaaAssistantArknights";
const ua = `Node.js/${process.versions.node} (${process.platform} ${os.release()}; ${process.arch})`;
console.info("process.env.THREAD:", process.env.THREAD);
const thread = Math.max(0, Math.min(os.cpus().length, Number.isSafeInteger(+process.env.THREAD) ? +process.env.THREAD : 4));
console.info("# of thread:", thread);
console.info("OWNER:", OWNER);
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
});
/**
 * @typedef { { size: number, etag: string, lastModified: Date, metaData: { [key: string]: any } } } BucketItemStat
 */
/**
 * @type {(objectName: string) => Promise<BucketItemStat>}
 */
const minioClientStatObject = (objectName) => new Promise((res) => minioClient.statObject(process.env.MINIO_BUCKET, objectName, (err, stat) => res(err ? {
    size: -1,
    etag: "",
    lastModified: new Date(-1),
    metaData: {},
} : stat)));

let releaseTag = process.env.RELEASE_TAG;
console.info("Fetching the release list");
/**
 * @typedef { { repo: string } & Awaited<ReturnType<octokit['rest']['repos']['getRelease']>>['data']['assets'][number] } Asset
 */
/**
 * @type { Asset[] }
 */
const assets = [];
const maaReleaseList = await octokit.rest.repos.listReleases({
    owner: OWNER,
    repo: "MaaRelease",
});
let maaReleaseFound;
if (!releaseTag) {
    console.info("No release_tag found in env, use the latest tag.");
    maaReleaseFound = maaReleaseList.data[0];
} else {
    console.info("release_tag in env:", releaseTag, "try to find this tag.");
    const found = maaReleaseList.data.find((release) => release.tag_name === releaseTag);
    if (found) {
        console.info("Tag found.");
        maaReleaseFound = found;
    } else {
        console.info("No tag found, use the latest tag.");
        maaReleaseFound = maaReleaseList.data[0];
    }
}
releaseTag = maaReleaseFound.tag_name;
console.info("release_tag:", releaseTag);
const maaAssistantArknightsList = await octokit.rest.repos.listReleases({
    owner: OWNER,
    repo: "MaaAssistantArknights",
});
const maaAssistantArknightsFound = maaAssistantArknightsList.data.find((release) => release.tag_name === releaseTag);
if (maaAssistantArknightsFound) {
    for (const asset of maaAssistantArknightsFound.assets) {
        asset.repo = "MaaAssistantArknights";
        assets.push(asset);
    }
}
for (const asset of maaReleaseFound.assets) {
    asset.repo = "MaaRelease";
    assets.push(asset);
}
const pattern = /-(?:win|linux)-|-macos-.+\.dmg/;
const filteredAssets = assets.filter(({ name }) => pattern.test(name));
console.info("# of assets:", assets.size);
console.info("# of filtered assets:", filteredAssets.length);

console.info("Start fetching...");
const beginHrtime = process.hrtime.bigint();
await Promise.all(Array.from({ length: thread }).map(async (_, i) => {
    let asset = filteredAssets.shift();
    while (asset) {
        console.info("[Thread", i, "]", "Get the stat from minio for", asset.name);
        const objectName = path.join(OWNER, asset.repo, "releases", "download", releaseTag, asset.name);
        const stat = await minioClientStatObject(objectName);
        if (stat.size > 0 && stat.size === asset.size) {
            console.info("[Thread", i, "]", asset.name, "is already uploaded, skip.");
        } else {
            console.info("[Thread", i, "]", asset.name, "unexists, start getting the downloadable link");
            const headers = {
                [http2.constants.HTTP2_HEADER_ACCEPT]: "application/octet-stream",
                [http2.constants.HTTP2_HEADER_AUTHORIZATION]: `Bearer ${token}`,
                [http2.constants.HTTP2_HEADER_USER_AGENT]: ua,
            };
            const response = await fetch(asset.url, {
                method: "HEAD",
                redirect: "manual",
                headers,
            });
            console.info("[Thread", i, "]", "Get the downloadable link of", asset.name, ", start downloading");
            const url = new URL(response.headers.get("location"));
            const client = http2.connect(url, {
                minVersion: "TLSv1.3",
                maxVersion: "TLSv1.3",
            });
            /**
             * @type { ReturnType<byteSize> }
             */
            let transferRates;
            let durationInSeconds = -1;
            const info = await new Promise((res, rej) => {
                client.on("error", (err) => {
                    rej(err);
                });
                const req = client.request({
                    [http2.constants.HTTP2_HEADER_METHOD]: http2.constants.HTTP2_METHOD_GET,
                    [http2.constants.HTTP2_HEADER_PATH]: `${url.pathname}${url.search}`,
                    ...headers,
                }, {
                    endStream: true,
                });
                req.on("response", async (headers) => {
                    console.info("[Thread", i, "]", "Get the stream of", asset.name, ", transfering to minio:", headers);
                    const transferredBytes = {
                        now: 0,
                        previous: 0,
                    };
                    let end = false;
                    minioClient.putObject(process.env.MINIO_BUCKET, objectName, req, asset.size, (err, info) => err ? rej(err) : res(info));
                    const startHrtime = process.hrtime.bigint();
                    req.on("data", (chunk) => {
                        const now = process.hrtime.bigint();
                        transferredBytes.now += chunk.length;
                        transferRates = byteSize(transferredBytes.now * 10 ** 6 / (Number(now - startHrtime) / 10 ** 3), { precision: 3, units: "iec" });
                        transferredBytes.previous = transferredBytes.now;
                    });
                    req.on("end", () => {
                        const now = process.hrtime.bigint();
                        end = true;
                        durationInSeconds = Number(now - startHrtime) / 10 ** 9;
                        transferRates = byteSize(asset.size * 10 ** 6 / (Number(now - startHrtime) / 10 ** 3), { precision: 3, units: "iec" });
                    });
                    req.on("error", () => end = true);
                    const total = byteSize(asset.size, { precision: 3, units: "iec" });
                    while (Number.MAX_SAFE_INTEGER > Number.MIN_SAFE_INTEGER) {
                        await timerPromises.setTimeout(5000);
                        if (!end) {
                            const progress = byteSize(transferredBytes.now, { precision: 3, units: "iec" });
                            console.info("[Thread", i, "]", "Stat", asset.name, "- progress:", progress.value, progress.unit, "/", total.value, total.unit, "=", +(transferredBytes.now * 100 / asset.size).toFixed(3), "% | average:", transferRates?.value, transferRates?.unit, "/s");
                        }
                    }
                    return;
                });
            });
            client.close();
            console.info("[Thread", i, "]", "The stream of", asset.name, "is ended, wait", MINIO_WAIT_TIME_AFTER_UPLOAD_MS, "ms and check the integrity.");
            await timerPromises.setTimeout(MINIO_WAIT_TIME_AFTER_UPLOAD_MS);
            const stat = await minioClientStatObject(objectName);
            if (stat.size > 0 && stat.size === asset.size) {
                console.info("[Thread", i, "]", "Uploaded", asset.name, ", Done:", { ...stat, ...info, durationInSeconds, transferRates });
            } else {
                console.error("[Thread", i, "]", "Uploaded", asset.name, ", failed, size not match - asset.size:", asset.size, "stat:", stat);
                throw new Error("Upload failed, size not match");
            }
        }
        asset = filteredAssets.shift();
    }
    console.info("[Thread", i, "]", "done.");
}));
const endHrtime = process.hrtime.bigint();
console.info("Download done, duration:", Number(endHrtime - beginHrtime) / 10 ** 9, "s, validating...");
const failedAssets = [];
for (const asset of filteredAssets) {
    const objectName = path.join(OWNER, asset.repo, "releases", "download", releaseTag, asset.name);
    const stat = await minioClientStatObject(objectName);
    if (stat.size > 0 && stat.size === asset.size) {
        continue;
    }
    console.info("The size of", asset.name, "is not match, asset.size:", asset.size, "stat:", stat);
    failedAssets.push(asset.name);
}
if (failedAssets.length === 0) {
    console.info("All assets are uploaded successfully.");
    process.exit(0);
}
console.info("Failed assets:", failedAssets);
process.exit(1);
