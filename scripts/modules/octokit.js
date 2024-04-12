import { Octokit } from "@octokit/rest";
import { retry } from "@octokit/plugin-retry";
import { createUnauthenticatedAuth } from "@octokit/auth-unauthenticated";

const defaultAuthOptions = {};
if (Reflect.has(process.env, "GITHUB_PAT")) {
    defaultAuthOptions.auth = process.env.GITHUB_PAT;
} else {
    defaultAuthOptions.authStrategy = createUnauthenticatedAuth;
    defaultAuthOptions.auth = {
        reason: "Not running in github actions, unable to get any auth.",
    };
}

const OctokitWithRetry = Octokit.plugin(retry);
class OctokitWithRetryAndDefaultAuthOptions extends OctokitWithRetry {
    /**
     * @param { ConstructorParameters<OctokitWithRetry>[0] } options
     */
    constructor(options) {
        super({
            ...defaultAuthOptions,
            ...options || {},
        });
    }
}

export { OctokitWithRetryAndDefaultAuthOptions as Octokit };
export default { OctokitWithRetryWithDefaultAuthOptions: Octokit };
