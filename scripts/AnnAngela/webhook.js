import console from "../modules/console.js";
import generateHMACSignature from "../modules/generateHMACSignature.js";

const data = {
    repository: process.env.GITHUB_REPOSITORY,
    triggeringActor: process.env.GITHUB_TRIGGERING_ACTOR,
    releaseTag: process.env.release_tag,
};
console.info("data:", data);
const body = Buffer.from(JSON.stringify(data), "utf-8");
for (let retryTime = 0; retryTime < 10; retryTime++) {
    console.info(`Attempt #${retryTime} running...`);
    try {
        const result = await (await fetch(process.env.WEBHOOK_URL, {
            headers: {
                "Content-Type": "application/json",
                "x-signature": generateHMACSignature(process.env.WEBHOOK_SECRET, body),
            },
            method: "POST",
            body,
        })).json();
        console.info("Attempt #", retryTime, "success, result:", result);
        console.info("Done.");
        process.exit(0);
    } catch (e) {
        console.error("Fail at attempt #", retryTime, ":", e);
        continue;
    }
}
console.error("Maximum retries exceeded, failed.");
process.exit(1);
