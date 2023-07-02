/* eslint-disable no-loop-func */
import { Octokit } from "../modules/octokit.js";
import path from "path";
import console from "../modules/console.js";
import thread from "../modules/getThreadNumber.js";
import { Client } from "minio";
const owner = "MaaAssistantArknights";
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
const releaseList = await octokit.rest.repos.listReleases({
    owner,
    repo: "MaaRelease",
});
let release_id;
if (!releaseTag) {
    console.info("No release_tag found in env, use the latest tag.");
    release_id = releaseList.data[0].id;
    releaseTag = releaseList.data[0].tag_name;
} else {
    console.info("release_tag in env:", releaseTag, "try to find this tag.");
    const found = releaseList.data.find((release) => release.tag_name === releaseTag);
    if (found) {
        console.info("Tag found.");
        release_id = found.id;
    } else {
        console.info("No tag found, use the latest tag.");
        release_id = releaseList.data[0].id;
        releaseTag = releaseList.data[0].tag_name;
    }
}
console.info("release_tag:", releaseTag);
console.info("release_id:", release_id);

const pattern = /-(?:win|linux)-|-macos-.+\.dmg/;
/**
 * @typedef { { repo: string } & Awaited<ReturnType<octokit['rest']['repos']['getRelease']>>['data']['assets'][number] } Asset
 */
/**
 * @type { Map<string, Asset>}
 */
const assets = new Map();
for (const repo of ["MaaRelease", "MaaAssistantArknights"]) {
    const release = await octokit.rest.repos.getRelease({
        owner,
        repo,
        release_id,
    });
    for (const asset of release.data.assets) {
        asset.repo = repo;
        assets.set(asset.name, asset);
    }
}
const filteredAssets = [...assets.values()].filter(({ name }) => pattern.test(name));
console.info("# of assets:", assets.size);
console.info("# of filtered assets:", filteredAssets.length);

console.info("Start fetching...");
await Promise.all(Array.from(({ length: thread }, async (_, i) => {
    let asset = filteredAssets.shift();
    while (asset) {
        console.info("[Thread", i, "]", "Get the stat from minio for", asset.name);
        const stat = await minioClient.statObject(process.env.MINIO_BUCKET, path.join(process.env.UPLOAD_DIR, asset.tag_name, asset.name)).catch(() => false);
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
            await minioClient.putObject(process.env.MINIO_BUCKET, path.join(process.env.UPLOAD_DIR, asset.tag_name, asset.name), file, asset.size);
            console.info("[Thread", i, "]", "Uploaded", asset.name, ", Done.");
        }
        asset = filteredAssets.shift();
    }
    console.info("[Thread", i, "]", "done.");
})));
console.info("Download done.");
