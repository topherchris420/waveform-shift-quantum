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
export default defineConfig(() => {
  const plugins = [react()];
  if (!process.env.VITEST && process.env.ENABLE_LOVABLE_MCP_SYNC === 'true') {
    plugins.push(mcpPlugin());
  }

  return {
    define: {
      __SOURCE_COMMIT__: JSON.stringify(sourceCommit),
    },
    server: {
      host: '::',
      port: 8080,
    },
    plugins,
    resolve: {
      alias: {
        '@': path.resolve(rootDir, './src'),
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom', 'react-router-dom'],
            'vendor-ui': [
              '@radix-ui/react-slot',
              '@radix-ui/react-separator',
              '@radix-ui/react-slider',
              '@radix-ui/react-tabs',
              '@radix-ui/react-tooltip',
              'lucide-react',
            ],
            'vendor-math': ['katex', 'react-katex', 'recharts'],
          },
        },
      },
    },
  };
});
