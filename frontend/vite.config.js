import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const repoName = process.env.GITHUB_REPOSITORY?.split('/')[1]
const isUserSite = repoName?.endsWith('.github.io')
const githubPagesBase = process.env.GITHUB_PAGES === 'true' && repoName && !isUserSite ? `/${repoName}/` : '/'

export default defineConfig({
  base: githubPagesBase,
  plugins: [react()],
})
