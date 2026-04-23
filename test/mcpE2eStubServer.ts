import http from 'node:http'
import type { AddressInfo } from 'node:net'

const STUB_SESSION_ID = 'mcp-browser-e2e-stub-session'

/**
 * 极简 Streamable HTTP MCP 桩：满足主进程 initialize → notifications/initialized → tools/list
 * 及会话关闭 DELETE，不访问外网，供 E2E 稳定跑 CI。
 */
export async function startMcpE2eStubServer(): Promise<{
  mcpUrl: string
  close: () => Promise<void>
}> {
  const server = http.createServer((req, res) => {
    if (req.method === 'DELETE') {
      res.writeHead(204).end()
      return
    }
    if (req.method !== 'POST') {
      res.writeHead(405).end()
      return
    }

    const chunks: Buffer[] = []
    req.on('data', (c) => {
      chunks.push(c)
    })
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8')
      let body: unknown
      try {
        body = raw ? (JSON.parse(raw) as unknown) : null
      } catch {
        res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' }).end('invalid json')
        return
      }

      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        res.writeHead(400).end()
        return
      }

      const msg = body as Record<string, unknown>
      const method = msg.method
      const id = msg.id

      if (method === 'initialize') {
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Mcp-Session-Id': STUB_SESSION_ID,
        })
        res.end(
          JSON.stringify({
            jsonrpc: '2.0',
            id,
            result: {
              protocolVersion: '2025-03-26',
              capabilities: {},
              serverInfo: { name: 'mcp-browser-e2e-stub', version: '0' },
            },
          }),
        )
        return
      }

      if (method === 'notifications/initialized') {
        res.writeHead(202).end()
        return
      }

      if (method === 'tools/list') {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(
          JSON.stringify({
            jsonrpc: '2.0',
            id,
            result: {
              tools: [
                {
                  name: 'e2e_echo',
                  description: 'E2E 本地桩工具',
                  inputSchema: { type: 'object', properties: {} },
                },
              ],
            },
          }),
        )
        return
      }

      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end(`unknown method: ${String(method)}`)
    })
  })

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => resolve())
  })

  const addr = server.address() as AddressInfo
  const port = addr.port
  const mcpUrl = `http://127.0.0.1:${port}/mcp`

  return {
    mcpUrl,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((err) => {
          if (err) reject(err)
          else resolve()
        })
      }),
  }
}
