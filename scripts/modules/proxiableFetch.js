import { ProxyAgent } from "undici";
import minimatch from "minimatch";

const proxyAgent = new ProxyAgent(process.env.HTTP_PROXY);
const noProxyDomains = (process.env.NO_PROXY || "").split(",");

const shouldUseProxy = (input) => {
    const hostname = URL.parse(input).hostname;
    return !noProxyDomains.some((domain) => minimatch(hostname, domain));
};

const proxiableFetch = (input, init = {}) => {
    if (shouldUseProxy(input)) {
        init.dispatcher = proxyAgent;
    }
    return fetch(input, init);
};
export default proxiableFetch;
