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
    port: process.env.MINIO_ENDPOINT_PORT,
    useSSL: false,
    accessKey: process.env.MINIO_ACCESS_KEY,
    secretKey: process.env.MINIO_ENDPOINT_PORT,
});
/**
 * @type { (bucketName: string, objectName: string, stream: Buffer) => Promise }
 */
const minioClientPutObject = (...args) => new Promise((res, rej) => minioClient.putObject(...args, (err, result) => err ? rej(err) : res(result)));

let releaseTag = process.env.releaseTag;
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

const pattern = /-(?:win|linux)-/;
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

console.info("Start downloading...");
await Promise.all(Array.from(({ length: thread }, async (_, i) => {
    let asset = filteredAssets.shift();
    while (asset) {
        console.info("[Thread", i, "]", "Downloading", asset.name);
        const file = await (await fetch(asset.url, {
            headers: {
                Accept: "application/octet-stream",
                Authorization: `Bearer ${token}`,
            },
        })).arrayBuffer();
        console.info("[Thread", i, "]", "Downloaded", asset.name, ", Uploading to minio");
        await minioClientPutObject(process.env.MINIO_BUCKET, path.join(process.env.UPLOAD_DIR, asset.tag_name, asset.name), Buffer.from(file.data));
        console.info("[Thread", i, "]", "Uploaded", asset.name, ", Done.");
        asset = filteredAssets.shift();
    }
    console.info("[Thread", i, "]", "done.");
})));
console.info("Download done.");
