import { defineConfig } from 'tsup';

export default defineConfig({
    name: 'esbuild-config',
    format: 'esm',
    entry: ['src/index.ts'],
    clean: true,
    dts: true,
})
