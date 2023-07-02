import console from "../modules/console.js";


const Authorization = `Basic ${Buffer.from(process.env.WEBHOOK_SECRET, "utf-8").toString("base64")}`;
for (let retryTime = 0; retryTime < 10; retryTime++) {
    console.info(`Attempt #${retryTime} running...`);
    try {
        const result = await (await fetch(process.env.WEBHOOK_URL, {
            headers: {
                Authorization,
            },
            method: "GET",
        })).text();
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
