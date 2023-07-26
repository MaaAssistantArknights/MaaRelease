import console from "../modules/console.js";
console.info("Start report.");
const result = await (await fetch("https://qqbot.annangela.cn/webhook?type=MaaRelease&origin=jenkins_errorReport", {
    headers: {
        "x-authorization": process.env.ANNANGELA_QQBOT_TOKEN,
    },
    data: {
        owner: process.env.OWNER,
        repo: process.env.REPO,
        RELEASE_TAG: process.env.RELEASE_TAG,
    },
})).json();
console.info("result:", result);
process.exit(0);
