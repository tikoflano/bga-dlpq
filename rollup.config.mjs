import typescript from "@rollup/plugin-typescript";

// Plugin to remove triple-slash reference directives from output
const stripReferenceDirectives = () => ({
  name: "strip-reference-directives",
  renderChunk(code) {
    // Remove triple-slash reference directives
    return code.replace(/\/\/\/ <reference[^>]*\/>\n?/g, "");
  },
});

export default {
  input: "modules/src/dondelaspapasqueman.ts",
  output: {
    file: "modules/js/Game.js",
    format: "es",
    sourcemap: false,
    inlineDynamicImports: true,
  },
  plugins: [
    typescript({
      tsconfig: "./tsconfig.json",
    }),
    stripReferenceDirectives(),
  ],
  treeshake: false,
};
