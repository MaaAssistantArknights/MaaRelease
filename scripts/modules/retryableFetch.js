import console from "../modules/console.js";

/**
 * @type { (input: RequestInfo | URL, init?: RequestInit & { _retriesNumber?: number }) => Promise<Response> }
 */
const retryableFetch = async (...args) => {
    let lastError;
    const retriesNumber = args[1]?._retriesNumber ?? 10;
    for (let retryTime = 0; retryTime < retriesNumber; retryTime++) {
        console.info(`Attempt #${retryTime} running...`);
        try {
            const response = await fetch(...args);
            console.info("Attempt #", retryTime, "success");
            return response;
        } catch (e) {
            console.error("Fail at attempt #", retryTime, ":", e);
            lastError = e;
            continue;
        }
    }
    console.error("Maximum retries exceeded, failed.");
    throw lastError;
};
export default retryableFetch;
