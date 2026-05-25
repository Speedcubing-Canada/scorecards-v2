import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  // loadEnv with '' prefix loads ALL vars (including non-VITE_ ones).
  // process.env alone doesn't include .env file values for non-VITE_ keys.
  const env = loadEnv(mode, process.cwd(), '')

  // Custom middleware: intercepts POST /wca-token, injects WCA_CLIENT_SECRET
  // server-side (never reaches the browser bundle), then forwards to WCA.
  function wcaTokenProxy(): Plugin {
    return {
      name: 'wca-token-proxy',
      configureServer(server) {
        server.middlewares.use('/wca-token', async (req, res) => {
          const chunks: Buffer[] = []
          req.on('data', (chunk: Buffer) => chunks.push(chunk))
          await new Promise<void>((resolve) => req.on('end', resolve))

          const params = new URLSearchParams(Buffer.concat(chunks).toString())

          if (env.WCA_CLIENT_SECRET) params.set('client_secret', env.WCA_CLIENT_SECRET)

          const wcaRes = await fetch('https://www.worldcubeassociation.org/oauth/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params.toString(),
          })

          const body = await wcaRes.text()
          res.writeHead(wcaRes.status, { 'Content-Type': 'application/json' })
          res.end(body)
        })
      },
    }
  }

  return {
    plugins: [react(), wcaTokenProxy()],
    server: { port: 5173 },
  }
})
