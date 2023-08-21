import console from "../modules/console.js";
import generateHMACSignature from "../modules/generateHMACSignature.js";
import retryableFetch from "../modules/retryableFetch.js";

const data = {
    repository: process.env.GITHUB_REPOSITORY,
    triggeringActor: process.env.GITHUB_TRIGGERING_ACTOR,
    releaseTag: process.env.release_tag,
};
console.info("data:", data);
const body = Buffer.from(JSON.stringify(data), "utf-8");
const result = await (await retryableFetch(process.env.WEBHOOK_URL, {
    headers: {
        "Content-Type": "application/json",
        "x-signature": generateHMACSignature(process.env.WEBHOOK_SECRET, body),
    },
    method: "POST",
    body,
})).json();
console.info("Result:", result);
console.info("Done.");
