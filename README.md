# SourceForge 加速器后端

一个基于 Next.js 和 CloudFlare Workers 的 SourceForge 反向代理加速服务，专为中国开发者提供高速访问体验。

## 功能特性

- 🚀 **高速访问**: 通过 CloudFlare 全球 CDN 网络加速
- 🛡️ **安全可靠**: 企业级安全防护，SSL 加密传输
- 📊 **智能缓存**: 自动缓存常用文件，提升访问速度
- 🌍 **全球覆盖**: 200+ 城市边缘节点，就近访问
- 📈 **实时监控**: 提供详细的性能统计和监控数据

## 部署步骤

### 1. 安装 Wrangler CLI

```bash
npm install -g wrangler
```

### 2. 登录 CloudFlare

```bash
wrangler auth login
```

### 3. 配置项目

编辑 `wrangler.toml` 文件，更新以下配置：

- `name`: 你的 Worker 名称
- `route.pattern`: 你的自定义域名
- `route.zone_name`: 你的域名

### 4. 部署到生产环境

```bash
wrangler deploy --env production
```

### 5. 部署到测试环境

```bash
wrangler deploy --env staging
```

## API 端点

### 基础信息

- `GET /` - API 信息和使用说明
- `GET /health` - 健康检查
- `GET /stats` - 实时统计数据

### 代理服务

- `GET /*` - SourceForge 文件代理下载

## 使用示例

### 原始链接
```
https://sourceforge.net/projects/vlc/files/3.0.18/win32/vlc-3.0.18-win32.exe/download
```

### 加速链接
```
https://sf-proxy.your-domain.com/projects/vlc/files/3.0.18/win32/vlc-3.0.18-win32.exe/download
```

## 支持的文件类型

- 压缩文件: `.zip`, `.tar.gz`, `.tar.bz2`, `.7z`, `.rar`
- 可执行文件: `.exe`, `.msi`, `.dmg`, `.pkg`, `.deb`, `.rpm`
- 应用程序: `.jar`, `.war`, `.apk`, `.ipa`
- 文档文件: `.pdf`, `.doc`, `.docx`, `.txt`, `.md`

## 性能优化

- **智能缓存**: 自动缓存常用文件，减少源站请求
- **压缩传输**: 支持 Gzip/Brotli 压缩，减少传输时间
- **边缘计算**: 在离用户最近的节点处理请求
- **负载均衡**: 自动选择最优的 SourceForge 镜像站点

## 监控和日志

Worker 提供详细的监控数据：

- 请求量统计
- 缓存命中率
- 平均响应时间
- 错误率统计
- 流量使用情况

## 故障排除

### 常见问题

1. **404 错误**: 检查原始 SourceForge 链接是否有效
2. **超时错误**: 可能是网络问题，稍后重试
3. **403 错误**: 可能触发了 SourceForge 的反爬虫机制

### 调试方法

1. 查看 CloudFlare Dashboard 中的 Worker 日志
2. 使用 `wrangler tail` 实时查看日志
3. 检查 `/health` 端点确认服务状态

## 安全考虑

- 只代理 SourceForge 官方域名的请求
- 限制支持的文件类型，防止滥用
- 实施请求频率限制
- 定期更新安全配置

## 贡献指南

欢迎提交 Issue 和 Pull Request 来改进这个项目。

## 许可证
```
MIT License

Copyright (c) 2025 Sf-Mirror-Workers

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
