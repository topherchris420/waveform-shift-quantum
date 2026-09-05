import { execFileSync } from 'node:child_process';
import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import { mcpPlugin } from '@lovable.dev/mcp-js/stacks/supabase/vite';

const rootDir = import.meta.dirname;

function resolveSourceCommit(): string {
  const envCommit =
    process.env.VITE_SOURCE_COMMIT ??
    process.env.VERCEL_GIT_COMMIT_SHA ??
    process.env.GITHUB_SHA;

  if (envCommit) {
    return envCommit;
  }

  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: rootDir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return 'unknown';
  }
}

const sourceCommit = resolveSourceCommit();

// https://vitejs.dev/config/
export default defineConfig(() => ({
  define: {
    __SOURCE_COMMIT__: JSON.stringify(sourceCommit),
  },
  server: {
    host: '::',
    port: 8080,
  },
  plugins: [react(), mcpPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(rootDir, './src'),
    },
  },
}));
