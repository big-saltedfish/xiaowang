import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { include: ['lib/voice/**/*.test.ts'], environment: 'node' } });
