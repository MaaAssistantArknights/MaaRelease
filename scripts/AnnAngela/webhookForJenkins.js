import console from "../modules/console.js";
import retryableFetch from "../modules/retryableFetch.js";

const Authorization = `Basic ${Buffer.from(process.env.WEBHOOK_SECRET, "utf-8").toString("base64")}`;
const result = await retryableFetch(process.env.WEBHOOK_URL, {
    headers: {
        Authorization,
    },
    method: "POST",
});
const headersEntries = [...result.headers.entries()];
const unsafeOrUnneedHeaders = [
    "x-content-type-options",
    "x-frame-options",
    "x-instance-identity",
];
const safeHeadersEntries = headersEntries.filter(([name]) => name.startsWith("x-") && !unsafeOrUnneedHeaders.includes(name));
console.info("Status:", result.status);
console.info("Headers:", Object.fromEntries(safeHeadersEntries));
console.info("Result:", await result.text());
console.info("Done.");
