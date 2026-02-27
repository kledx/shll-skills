import { defineConfig } from "tsup";

export default defineConfig({
    entry: ["src/index.ts", "src/mcp.ts"],
    format: ["cjs", "esm"],
    dts: true,
    clean: true,
    noExternal: ["shll-policy-sdk"],
    target: "node18",
});
