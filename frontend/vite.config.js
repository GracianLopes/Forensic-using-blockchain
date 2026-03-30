import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
const isGitHubActions = process.env.GITHUB_ACTIONS === 'true';
const repoName = process.env.GITHUB_REPOSITORY?.split('/')[1] ?? 'Forensic-using-blockchain';
export default defineConfig({
    base: isGitHubActions ? `/${repoName}/` : '/',
    plugins: [react()],
    server: {
        port: 5173,
        proxy: {
            '/api': {
                target: 'http://localhost:3000',
                changeOrigin: true
            }
        }
    }
});
