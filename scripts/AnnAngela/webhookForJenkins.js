import console from "../modules/console.js";
import retryableFetch from "../modules/retryableFetch.js";

const Authorization = `Basic ${Buffer.from(process.env.WEBHOOK_SECRET, "utf-8").toString("base64")}`;
const result = await (await retryableFetch(process.env.WEBHOOK_URL, {
    headers: {
        Authorization,
    },
    method: "GET",
})).text();
console.info("Result:", result);
console.info("Done.");
process.exit(0);
