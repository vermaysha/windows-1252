import { $ } from 'bun';
import { build, type Options } from 'tsup';
import { fixImportsPlugin } from 'esbuild-fix-imports-plugin';

await $`rm -rf dist`;

await build({
  entry: ['src/**/*.ts'],
  outDir: 'dist',
  format: ['esm', 'cjs'],
  target: 'node20',
  minifySyntax: true,
  minifyWhitespace: true,
  minifyIdentifiers: true,
  splitting: false,
  sourcemap: false,
  cjsInterop: false,
  clean: true,
  bundle: false,
  esbuildPlugins: [fixImportsPlugin()],
});

await $`tsc --project tsconfig.dts.json`;

// await Bun.build({
//   entrypoints: ['./src/index.ts'],
//   outdir: './dist/bun',
//   minify: {
//     whitespace: true,
//     syntax: true,
//     identifiers: true,
//   },
//   target: 'bun',
//   sourcemap: 'linked',
// });

process.exit();
