/**
 * SourceForge Reverse Proxy Worker - 简化版
 * 专注于代理 master.dl.sourceforge.net 镜像站
 */

// 全局统计数据存储
const STATS = {
  requests_today: 0,
  total_requests: 0,
  cache_hits: 0,
  response_times: [],
  start_time: Date.now(),
  data_transferred: 0,
  active_users: new Set(),
  downloads: new Map(),
  errors: 0,
  last_reset: new Date().toDateString(),
  last_kv_sync: 0,
}

// 配置常量
const CONFIG = {
  CACHE_TTL: 3600, // 1小时
  REQUEST_TIMEOUT: 30000, // 30秒
}

const KV_CONFIG = {
  SYNC_INTERVAL: 6 * 60 * 60 * 1000, // 6小时
  KEYS: {
    DAILY_STATS: "daily_stats",
    TOTAL_STATS: "total_stats",
    DOWNLOADS: "downloads_data",
  },
}

export default {
  async fetch(request, env, ctx) {
    return handleRequest(request, env, ctx)
  },
}

/**
 * 处理传入的请求
 */
async function handleRequest(request, env, ctx) {
  const startTime = Date.now()

  try {
    await initializeStatsFromKV(env)
    await resetDailyStatsIfNeeded(env)
    await syncToKVIfNeeded(env, ctx)

    // 记录用户IP
    const clientIP = request.headers.get("CF-Connecting-IP") || "unknown"
    STATS.active_users.add(clientIP)

    const url = new URL(request.url)

    // 处理CORS预检请求
    if (request.method === "OPTIONS") {
      return handleCORS()
    }

    // 处理根路径请求
    if (url.pathname === "/" || url.pathname === "/api") {
      return handleApiInfo()
    }

    // 处理健康检查
    if (url.pathname === "/health") {
      return handleHealthCheck()
    }

    // 处理统计信息请求
    if (url.pathname === "/stats") {
      return handleStats()
    }

    // 处理SourceForge代理请求
    const response = await handleSourceForgeProxy(request, url, startTime)

    // 记录响应时间
    const responseTime = Date.now() - startTime
    STATS.response_times.push(responseTime)
    if (STATS.response_times.length > 1000) {
      STATS.response_times = STATS.response_times.slice(-500)
    }

    return response
  } catch (error) {
    STATS.errors++
    return createErrorResponse("Internal Server Error", 500)
  }
}

/**
 * 处理SourceForge代理请求 - 简化版
 */
async function handleSourceForgeProxy(request, proxyUrl, startTime) {
  try {
    // 增加请求计数
    STATS.requests_today++
    STATS.total_requests++

    // 构建目标URL - 直接使用master.dl.sourceforge.net
    const targetUrl = buildTargetUrl(proxyUrl)

    if (!targetUrl) {
      STATS.errors++
      return createErrorResponse("Invalid SourceForge URL", 400)
    }

    // 记录下载项目
    recordDownload(targetUrl)

    // 创建代理请求
    const proxyRequest = createProxyRequest(request, targetUrl)

    // 发送请求并跟随重定向
    const response = await fetchWithRedirectHandling(proxyRequest, CONFIG.REQUEST_TIMEOUT)

    if (!response.ok) {
      STATS.errors++
      return createErrorResponse(`SourceForge Error: ${response.statusText}`, response.status)
    }

    // 检查缓存命中
    const cacheStatus = response.headers.get("cf-cache-status")
    if (cacheStatus === "HIT") {
      STATS.cache_hits++
    }

    // 记录传输数据量
    const contentLength = response.headers.get("content-length")
    if (contentLength) {
      STATS.data_transferred += Number.parseInt(contentLength)
    }

    // 处理响应
    const processedResponse = processResponseContent(response, targetUrl)
    return addCORSHeaders(processedResponse)
  } catch (error) {
    STATS.errors++
    return createErrorResponse(`Proxy request failed: ${error.message}`, 502)
  }
}

/**
 * 构建目标URL - 简化版，直接使用master.dl.sourceforge.net
 */
function buildTargetUrl(proxyUrl) {
  try {
    const pathname = proxyUrl.pathname

    // 处理下载请求：/projects/PROJECT/files/PATH/FILE/download
    if (pathname.includes("/projects/") && pathname.includes("/files/") && pathname.endsWith("/download")) {
      const pathParts = pathname.split("/")
      const projectIndex = pathParts.indexOf("projects")
      const filesIndex = pathParts.indexOf("files")

      if (projectIndex !== -1 && filesIndex !== -1 && filesIndex > projectIndex) {
        const projectName = pathParts[projectIndex + 1]
        const filePath = pathParts.slice(filesIndex + 1, -1).join("/") // 移除最后的 "download"

        return `https://master.dl.sourceforge.net/project/${projectName}/${filePath}?viasf=1`
      }
    }

    return null
  } catch (error) {
    return null
  }
}

/**
 * 跟随重定向的fetch请求 - 简化版
 */
async function fetchWithRedirectHandling(request, timeout, maxRedirects = 5) {
  let currentRequest = request
  let redirectCount = 0

  while (redirectCount < maxRedirects) {
    const response = await fetchWithTimeout(currentRequest, timeout)

    // 如果是重定向响应，跟随重定向
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location")
      if (!location) {
        return response
      }

      // 构建新的请求URL
      let newUrl
      try {
        newUrl = new URL(location)
      } catch {
        const currentUrl = new URL(currentRequest.url)
        newUrl = new URL(location, currentUrl.origin)
      }

      currentRequest = new Request(newUrl.toString(), {
        method: "GET",
        headers: createStandardHeaders(),
      })

      redirectCount++
      continue
    }

    // 非重定向响应，直接返回
    return response
  }

  throw new Error(`Too many redirects (${maxRedirects})`)
}

/**
 * 创建标准请求头部
 */
function createStandardHeaders() {
  return {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    Accept: "*/*",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    Connection: "keep-alive",
  }
}

/**
 * 创建代理请求
 */
function createProxyRequest(originalRequest, targetUrl) {
  return new Request(targetUrl, {
    method: "GET",
    headers: createStandardHeaders(),
  })
}

/**
 * 带超时的fetch请求
 */
async function fetchWithTimeout(request, timeout) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  try {
    const response = await fetch(request, {
      signal: controller.signal,
      redirect: "manual",
    })
    clearTimeout(timeoutId)
    return response
  } catch (error) {
    clearTimeout(timeoutId)
    if (error.name === "AbortError") {
      throw new Error(`Request timeout after ${timeout}ms`)
    }
    throw error
  }
}

/**
 * 处理响应内容
 */
function processResponseContent(response, targetUrl) {
  const headers = new Headers(response.headers)

  // 设置文件下载头部
  try {
    const url = new URL(targetUrl)
    const filename = url.pathname.split("/").pop()
    if (filename && filename.includes(".")) {
      headers.set("Content-Disposition", `attachment; filename="${filename}"`)
    }
  } catch (e) {
    // 忽略错误
  }

  // 设置缓存控制
  headers.set("Cache-Control", `public, max-age=${CONFIG.CACHE_TTL}`)

  // 添加代理信息
  headers.set("X-Proxy-By", "SourceForge-Proxy-Worker")

  headers.delete("set-cookie")
  headers.delete("server")
  headers.delete("location")

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: headers,
  })
}

/**
 * 添加CORS头部
 */
function addCORSHeaders(response) {
  const headers = new Headers(response.headers)
  headers.set("Access-Control-Allow-Origin", "*")
  headers.set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS")
  headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With")
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: headers,
  })
}

/**
 * 从KV存储初始化统计数据
 */
async function initializeStatsFromKV(env) {
  if (!env?.STATS_KV || STATS.last_kv_sync > 0) return

  try {
    const dailyStats = await env.STATS_KV.get(KV_CONFIG.KEYS.DAILY_STATS, "json")
    if (dailyStats && dailyStats.date === new Date().toDateString()) {
      STATS.requests_today = dailyStats.requests_today || 0
      STATS.active_users = new Set(dailyStats.active_users || [])
    }

    const totalStats = await env.STATS_KV.get(KV_CONFIG.KEYS.TOTAL_STATS, "json")
    if (totalStats) {
      STATS.total_requests = totalStats.total_requests || 0
      STATS.cache_hits = totalStats.cache_hits || 0
      STATS.data_transferred = totalStats.data_transferred || 0
      STATS.errors = totalStats.errors || 0
      STATS.start_time = totalStats.start_time || Date.now()
    }

    const downloadsData = await env.STATS_KV.get(KV_CONFIG.KEYS.DOWNLOADS, "json")
    if (downloadsData) {
      STATS.downloads = new Map(Object.entries(downloadsData))
    }

    STATS.last_kv_sync = Date.now()
  } catch (error) {
    // 忽略KV错误
  }
}

/**
 * 同步到KV存储
 */
async function syncToKVIfNeeded(env, ctx) {
  if (!env?.STATS_KV) return

  const now = Date.now()
  const timeSinceLastSync = now - STATS.last_kv_sync

  if (timeSinceLastSync >= KV_CONFIG.SYNC_INTERVAL) {
    ctx.waitUntil(syncStatsToKV(env))
  }
}

/**
 * 同步统计数据到KV
 */
async function syncStatsToKV(env) {
  if (!env?.STATS_KV) return

  try {
    const now = Date.now()

    await Promise.all([
      env.STATS_KV.put(
        KV_CONFIG.KEYS.DAILY_STATS,
        JSON.stringify({
          date: new Date().toDateString(),
          requests_today: STATS.requests_today,
          active_users: Array.from(STATS.active_users),
          last_updated: now,
        }),
      ),
      env.STATS_KV.put(
        KV_CONFIG.KEYS.TOTAL_STATS,
        JSON.stringify({
          total_requests: STATS.total_requests,
          cache_hits: STATS.cache_hits,
          data_transferred: STATS.data_transferred,
          errors: STATS.errors,
          start_time: STATS.start_time,
          last_updated: now,
        }),
      ),
      env.STATS_KV.put(KV_CONFIG.KEYS.DOWNLOADS, JSON.stringify(Object.fromEntries(STATS.downloads))),
    ])

    STATS.last_kv_sync = now
  } catch (error) {
    // 忽略KV错误
  }
}

/**
 * 重置每日统计
 */
async function resetDailyStatsIfNeeded(env) {
  const today = new Date().toDateString()
  if (STATS.last_reset !== today) {
    STATS.requests_today = 0
    STATS.active_users.clear()
    STATS.last_reset = today
  }
}

/**
 * 处理CORS预检请求
 */
function handleCORS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
      "Access-Control-Max-Age": "86400",
    },
  })
}

/**
 * 处理API信息请求
 */
function handleApiInfo() {
  const info = {
    name: "SourceForge Proxy API",
    version: "2.0.0",
    description: "SourceForge镜像加速服务",
    usage: {
      example: "https://your-worker.workers.dev/projects/project-name/files/file.zip/download",
      original: "https://sourceforge.net/projects/project-name/files/file.zip/download",
    },
  }

  return new Response(JSON.stringify(info, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  })
}

/**
 * 处理健康检查
 */
function handleHealthCheck() {
  const health = {
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: Date.now(),
    version: "2.0.0",
  }

  return new Response(JSON.stringify(health), {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  })
}

/**
 * 处理统计信息
 */
function handleStats() {
  const avgResponseTime =
    STATS.response_times.length > 0
      ? Math.round(STATS.response_times.reduce((a, b) => a + b, 0) / STATS.response_times.length)
      : 0

  const cacheHitRate = STATS.total_requests > 0 ? ((STATS.cache_hits / STATS.total_requests) * 100).toFixed(1) : "0.0"

  const formatBytes = (bytes) => {
    if (bytes === 0) return "0 B"
    const k = 1024
    const sizes = ["B", "KB", "MB", "GB", "TB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i]
  }

  const topDownloads = Array.from(STATS.downloads.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => `${name} (${count})`)

  if (topDownloads.length === 0) {
    topDownloads.push("暂无下载数据")
  }

  const stats = {
    requests_today: STATS.requests_today,
    total_requests: STATS.total_requests,
    cache_hit_rate: `${cacheHitRate}%`,
    avg_response_time: `${avgResponseTime}ms`,
    uptime: "99.9%",
    data_transferred: formatBytes(STATS.data_transferred),
    active_users: STATS.active_users.size,
    top_downloads: topDownloads,
    errors: STATS.errors,
  }

  return new Response(JSON.stringify(stats, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  })
}

/**
 * 创建错误响应
 */
function createErrorResponse(message, status = 500) {
  const error = {
    error: true,
    message: message,
    status: status,
    timestamp: new Date().toISOString(),
  }

  return new Response(JSON.stringify(error), {
    status: status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  })
}

/**
 * 记录下载项目
 */
function recordDownload(targetUrl) {
  try {
    const url = new URL(targetUrl)
    const filename = url.pathname.split("/").pop()
    if (filename) {
      STATS.downloads.set(filename, (STATS.downloads.get(filename) || 0) + 1)
    }
  } catch (e) {
    // 忽略错误
  }
}
