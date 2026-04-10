import { shell } from 'electron'

function isHttpLoopbackHost(hostname: string): boolean {
  const h = hostname.toLowerCase()
  return h === 'localhost' || h === '127.0.0.1' || h === '[::1]' || h === '::1'
}

/**
 * 在系统默认浏览器中打开外链：放行 https；http 仅放行本机回环（本地文档 / 开发服务）。
 * @returns 是否已处理（已调用 openExternal）
 */
export function openExternalUrlIfAllowed(rawUrl: string): boolean {
  let u: URL
  try {
    u = new URL(rawUrl)
  } catch {
    return false
  }

  if (u.protocol === 'https:') {
    void shell.openExternal(rawUrl)
    return true
  }

  if (u.protocol === 'http:' && isHttpLoopbackHost(u.hostname)) {
    void shell.openExternal(rawUrl)
    return true
  }

  return false
}
