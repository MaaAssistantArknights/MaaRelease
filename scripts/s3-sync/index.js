/* eslint-disable no-loop-func */
import { Octokit } from "../modules/octokit.js";
import path from "path";
import console from "../modules/console.js";
import thread from "../modules/getThreadNumber.js";
import { Client } from "minio";
import { Readable } from "node:stream";
const owner = "MaaAssistantArknights";
console.info("process.env.UPLOAD_DIR:", process.env.UPLOAD_DIR);
console.info("Initialization done.");

const octokit = new Octokit({});
const { token } = await octokit.auth();
const minioClient = new Client({
    endPoint: process.env.MINIO_ENDPOINT,
    port: +process.env.MINIO_ENDPOINT_PORT,
    useSSL: false,
    accessKey: process.env.MINIO_ACCESS_KEY,
    secretKey: process.env.MINIO_ENDPOINT_PORT,
});

let releaseTag = process.env.RELEASE_TAG;
console.info("Fetching the release list");
/**
 * @typedef { { repo: string } & Awaited<ReturnType<octokit['rest']['repos']['getRelease']>>['data']['assets'][number] } Asset
 */
/**
 * @type { Map<string, Asset>}
 */
const assets = new Map();
const maaReleaseList = await octokit.rest.repos.listReleases({
    owner,
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
for (const asset of maaReleaseFound.assets) {
    asset.repo = "MaaRelease";
    assets.set(asset.name, asset);
}
console.info("release_tag:", releaseTag);
const maaAssistantArknightsList = await octokit.rest.repos.listReleases({
    owner,
    repo: "MaaAssistantArknights",
});
const maaAssistantArknightsFound = maaAssistantArknightsList.data.find((release) => release.tag_name === releaseTag);
if (!maaAssistantArknightsFound) {
    throw new Error(`No release named ${releaseTag} found in MaaAssistantArknights`);
}
for (const asset of maaAssistantArknightsFound.assets) {
    asset.repo = "MaaAssistantArknights";
    assets.set(asset.name, asset);
}
const { created_at } = maaAssistantArknightsFound;
console.info("created_at:", created_at);
const pattern = /-(?:win|linux)-|-macos-.+\.dmg/;
const filteredAssets = [...assets.values()].filter(({ name }) => pattern.test(name));
console.info("# of assets:", assets.size);
console.info("# of filtered assets:", filteredAssets.length);

console.info("Start fetching...");
await Promise.all(Array.from({ length: thread }).map(async (_, i) => {
    let asset = filteredAssets.shift();
    while (asset) {
        console.info("[Thread", i, "]", "Get the stat from minio for", asset.name);
        const objectName = path.join(process.env.UPLOAD_DIR, releaseTag, asset.name);
        const stat = await new Promise((res) => minioClient.statObject(process.env.MINIO_BUCKET, objectName, (err, stat) => res(err ? {} : stat)));
        const size = Reflect.has(stat, "size") && typeof stat.size === "number" ? stat.size : -1;
        if (size > 0 && size === asset.size) {
            console.info("[Thread", i, "]", asset.name, "is already uploaded, skip.");
        } else {
            console.info("[Thread", i, "]", asset.name, "unexists, start downloading");
            const file = (await fetch(asset.url, {
                headers: {
                    Accept: "application/octet-stream",
                    Authorization: `Bearer ${token}`,
                },
            })).body;
            if (!file) {
                throw new Error("Stream is null");
            }
            console.info("[Thread", i, "]", "Get the stream of", asset.name, ", transfering to minio");
            const info = await new Promise((res, rej) => minioClient.putObject(process.env.MINIO_BUCKET, objectName, new Readable().wrap(file), asset.size, (err, info) => err ? rej(err) : res(info)));
            console.info("[Thread", i, "]", "Uploaded", asset.name, ", Done:", info);
        }
        asset = filteredAssets.shift();
    }
    console.info("[Thread", i, "]", "done.");
}));
console.info("Download done.");
