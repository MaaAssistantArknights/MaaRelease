import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

export default defineConfig({
    root: "src",
    // 页面在 /MaaAssistantArknights/api/qqgroup/ 子路径下，不能用绝对路径
    base: "./",
    publicDir: false,
    plugins: [viteSingleFile()],
    build: {
        outDir: "..",
        // outDir 是 root 的父目录且包含 src/ 源码，绝不能清空
        emptyOutDir: false,
        // 产物是提交进仓库的文件，不压缩便于 review；需要时可改回 "esbuild"
        minify: false,
    },
});
