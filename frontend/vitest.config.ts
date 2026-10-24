import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
export default defineConfig({ plugins: [react()], test: { environment: 'jsdom', include: ['test/**/*.{test,spec}.?(c|m)[jt]s?(x)'], coverage: { provider: 'v8', include: ['components/{workflow,assessment-form,market-controls,evidence-controls,gtm-controls,report-controls,report-view}.tsx', 'lib/**/*.ts'], exclude: ['test/**', 'tests/e2e.spec.ts', '**/*.config.*', '.next/**'], thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 } } } })
