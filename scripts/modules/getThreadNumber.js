import console from "../modules/console.js";
import os from "os";

console.info("process.env.THREAD:", process.env.THREAD);
const thread = Math.max(0, Math.min(os.cpus().length, Number.isSafeInteger(+process.env.THREAD) ? +process.env.THREAD : 4));
console.info("# of thread:", thread);

export default thread;
