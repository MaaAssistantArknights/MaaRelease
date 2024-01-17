import { configs } from "@annangela/eslint-config";
/**
 * @type { import("eslint").Linter.FlatConfigFileSpec }
 */
const ignores = [
    "**/dist/**",
    "**/.*/**",
    "node_modules",
];
/**
 * @type { import("eslint").Linter.FlatConfig[] }
 */
const config = [
    // base
    {
        ...configs.base,
        files: [
            "**/*.js",
            "**/*.ts",
        ],
        ignores,
    },
    {
        ...configs.node,
        files: [
            "**/*.js",
            "**/*.ts",
        ],
        ignores,
    },
    // For TypeScript files
    {
        ...configs.typescript,
        files: [
            "**/*.ts",
        ],
        ignores,
    },
    // Running in trusted environment
    {
        rules: {
            "security/detect-unsafe-regex": "off",
            "security/detect-object-injection": "off",
            "security/detect-non-literal-fs-filename": "off",
            "security/detect-non-literal-regexp": "off",
        },
    },
];
export default config;
