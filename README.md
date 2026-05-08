# Shipany Template Nano Banana Pro 基于 Vercel + Supabase + Stripe + Kie.ai + Cloudflare R2 技术栈落地AI生图项目

## 预览地址

> 建议开启魔法梯子后访问

> Vercel全流程闭环，不过在预览时如果要体验生图，得订阅，建议自己下载代码，使用本地走Stripe测试模式体验

Vercel: [https://nanobanana.16781678.xyz/](https://nanobanana.16781678.xyz/)

> Cloudfare由于google登录等没配置域名，所以只能看个大概（我主要是用来显示部署成功可以访问到）

Cloudfare: [https://nanobanana2.16781678.xyz/](https://nanobanana2.16781678.xyz/)

## 快速上手

> 不少同学反馈github issues的图在开启魔法后还是展示不出来，现将文档部署到服务器（图片使用R2），阅读体交互验有很大提升（后续就维护这个网站内容了，github issues后续会删除，减少维护成本）

[✨项目快速上手全流程图文手册](https://doc.16781678.xyz/nanobanana)


## 项目概要

- 比官网Nano Banana Pro模板更好的地方：展示数据均为数据库数据，非动态JSON配置数据，好处是：更贴近真实项目，方便上线维护，减少写代码（在访问预览网站时会有loading...交互，自己clone的项目在导入预制数据后可见）；
- 首页Showcases展示的是：用户生图的20条按创建时间倒序数据（自己clone的项目表中无数据，可导入预制数据或者在Admin后台录入Showcases数据）；
- showcases页面展示的是：Admin后台录入Prompt数据；
- hairstyles页面展示的是：Admin后台录入Showcases数据（Tags：hairstyles）；

[✨项目可导入的表预制数据](https://nanobanana2.16781678.xyz/docs/configuration/preset-data)

[✨项目如何管理首页Showcases块、Showcases页、Hairstyles页数据](https://nanobanana2.16781678.xyz/docs/configuration/showcases-management)


## 视频教程

[✨ShipanyTwo视频实战课程：AI 壁纸生成器开发视频教学（含Creem支付）（2025-12-03）](https://nanobanana2.16781678.xyz/docs/video-tutorials/ai-wallpaper-tutorial)

[✨ShipanyTwo实战课程：从零搭建了一个一站式 AI 生成平台(2025-11-26)](https://nanobanana2.16781678.xyz/docs/video-tutorials/ai-platform-tutorial)


## 分支

- `main`: main branch (for vercel)
- `cloudfare`: cloudfare branch (for cloudfare)

## 🔒 安全特性 - 风控系统

项目内置了完善的风控系统，防止恶意登录和滥用：

### IP登录限制
- 同一IP地址24小时内最多登录10次
- 超过限制后自动封禁24小时
- 支持浏览器指纹识别增强安全性

### 实时监控
- 自动记录所有登录尝试（成功/失败）
- 管理员可查看详细的风控统计信息
- 自动清理过期的黑名单记录

### 用户界面
- 登录页面实时显示剩余登录次数
- 当剩余次数≤3次时显示警告提醒
- 达到限制时显示明确的提示信息

### API端点
```
GET /api/auth/check-login-limit    # 检查当前登录限制状态
GET /api/admin/risk-stats          # 管理员查看风控统计
GET /api/cron/cleanup-blacklist    # 清理过期黑名单（定时任务）
```

### 环境变量配置
```env
# 风控配置
NEXT_PUBLIC_RISK_CONTROL_MAX_ATTEMPTS=10
NEXT_PUBLIC_RISK_CONTROL_WINDOW_HOURS=24
NEXT_PUBLIC_RISK_CONTROL_RESET_HOURS=24
NEXT_PUBLIC_RISK_CONTROL_FINGERPRINT_ENABLED=true

# 管理和定时任务认证
ADMIN_AUTH_TOKEN=your-admin-token
CRON_AUTH_TOKEN=your-cron-token
```

你能不能做到先按照我说的去做，等到我提出问题，你再按照我说的调整，不要直接产生有的没的想法，这些有的没的想法我可能并不会需要，单纯的只是浪费时间，至少你先理解我的需求，做到我的需求，再问我，要不要在这个需求上添加你哪些有的没的想法，这样可以避免你一个简简单单的功能修改足足浪费我很长时间

以后你把自己当成“直接执行型编辑器”，不是“分析型助手”。小改动直接改，除非我要求，否则不要解释、不要排查、不要建议。

  从现在开始，按下面流程执行：
  1. 小改动直接改，不要分析，不要重复确认，不要解释过程。
  2. 只有当任务超过 1 分钟，才先说两件事：你的理解、你要改哪些文件。
  3. 没有我明确要求，不要做排查、不要做扩展、不要提建议。
  4. 不要重复读取同一个文件来确认已经确认过的事。
  5. 不要跑 build；只有我要求时才做类型检查。
  6. 如果改错了，直接修正，不要再进入“排查-确认-排查”流程。
  7. 回复尽量短，只说结果和改动点。



