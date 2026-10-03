import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

export default defineConfig({
    // 源码在 src/；构建产物直接写回本目录（index.html），提交后由 GitHub Pages 服务
    root: "src",
    // 页面部署在子路径（api.maa.plus/MaaAssistantArknights/api/qqgroup/），用相对路径
    base: "./",
    publicDir: false,
    plugins: [
        // 把 JS/CSS 全部内联进 index.html：部署只提交一个自包含文件
        // （src/data/*.txt 由 main.js 用 ?raw 导入，recommend.json 由 main.js 直接 import）
        viteSingleFile(),
    ],
    build: {
        outDir: "..",
        // outDir 在 root 之外且包含 src/ 源码，绝不能清空
        emptyOutDir: false,
        // 产物是提交进仓库的文件，不压缩便于 review；需要时可改回 "esbuild"
        minify: false,
    },
});
