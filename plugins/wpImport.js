/** @type {import("esbuild").Plugin} */
const wpImport = {
  name: "webpackImports",
  setup(build) {
    build.onResolve({ filter: /^@moonlight-mod\/wp\// }, (args) => {
      const wpModule = args.path.replace(/^@moonlight-mod\/wp\//, "");
      return {
        path: wpModule,
        external: true
      };
    });
  }
};

export default wpImport;
