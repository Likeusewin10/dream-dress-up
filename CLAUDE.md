# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

梦想变装 (Dream Dress-Up) - 一个让孩子拍照并实现梦想变装的 AI 应用。用户拍照后输入梦想描述，AI 会生成变装后的图片，具有拍立得相机风格界面和胶片显影动画效果。

## Commands

```bash
npm run dev      # 启动开发服务器 (localhost:5173)
npm run build    # TypeScript 编译 + Vite 构建
npm run lint     # ESLint 检查
npm run preview  # 预览生产构建
```

## Tech Stack

- React 19 + TypeScript 5.9
- Vite 7
- 纯 CSS3（无 UI 框架）
- 支持深色/浅色模式自动切换（跟随系统设置）

## Architecture

```
src/
├── App.tsx                 # 主应用组件（包含所有 UI 和状态逻辑）
├── App.css                 # 主样式文件
├── types/index.ts          # TypeScript 类型定义 + 图像模型配置
├── services/
│   ├── settings.ts         # 设置管理器（localStorage + URL 参数）
│   ├── image-api.ts        # AI 图像生成 API 调用
│   ├── sound.ts            # 音效服务（Web Audio API 合成）
│   ├── share.ts            # 分享服务（生成分享卡片、系统分享）
│   └── image-storage.ts    # IndexedDB 图片存储服务
└── constants/dreams.ts     # 提示词模板定义
```

### 核心数据流

1. **拍照/上传** → `capturedPhoto` state → 左侧表单输入梦想
2. **确认生成** → 创建 `FilmPhoto` 对象（带弹出动画）→ 调用 `generateImage` API
3. **显影动画** → `developProgress` 从 0 到 100 → 完成后转为 `HistoryItem` 存入 localStorage
4. **图片持久化** → 生成完成后自动将图片保存到 IndexedDB（避免 CDN URL 过期）

### 关键状态

- `films: FilmPhoto[]` - 正在生成/显影中的胶片（画板上可拖拽）
- `history: HistoryItem[]` - 已完成的照片（持久化到 localStorage）
- 胶片状态流转：`isEjecting` → `isGenerating` → `isDeveloping` → 完成（或 `isFailed`）

### 生成失败重试

- 生成失败后胶片保留在原位，显示原图 + 红色遮罩层
- 遮罩显示 "✕ 生成失败"，下方有「重试」和「删除」按钮
- 点击重试会使用原有照片和梦想描述重新调用 API
- 主要函数：`handleRetryGenerate(filmId)`, `handleDeleteFailedFilm(filmId)`
- 样式：`.film-failed-overlay`, `.film-retry-btn`, `.film-delete-btn`（App.css）

### API 集成

- 使用 OpenAI 兼容的图像生成 API（默认 `api.tu-zi.com`）
- 支持通过 URL 参数传入 API 配置：`?apiKey=xxx` 或 `?settings={"key":"xxx","url":"xxx"}`
- 模型配置在 `src/types/index.ts` 的 `IMAGE_MODELS` 数组中
- **API Key 缺失提示**：未设置时点击生成会打开设置面板，显示黄色警告条 + 红色高亮输入框 + 自动聚焦

### 主题系统

- 使用 CSS 变量实现深浅色主题，定义在 `src/index.css`
- 通过 `@media (prefers-color-scheme: dark)` 自动切换
- 主要变量：`--bg-primary`, `--text-primary`, `--card-bg`, `--border-color` 等

### 音效系统

- 默认使用 Web Audio API 合成音效，支持自定义音频文件替换
- 音效类型：快门、上传、开关摄像头、模板切换、确认、完成、错误、胶片弹出、显影、点击
- 支持按类别控制开关：快门、相机、操作、反馈、动画、界面音效
- 默认仅开启：快门、相机、动画音效
- 设置持久化到 localStorage（key: `dream-dress-sound-settings`）
- 主要 API：`playSound(type)`, `toggleMasterMute()`, `toggleCategory(category)`

**自定义音效**：将音频文件放到 `public/sounds/` 目录，文件名对应音效类型：
```
shutter.mp3, upload.mp3, cameraOn.mp3, cameraOff.mp3, modeSwitch.mp3,
confirm.mp3, complete.mp3, error.mp3, eject.mp3, developing.mp3, click.mp3
```
支持格式：mp3、wav、ogg。有自定义文件时优先使用，否则用合成音效。

### 模板快速切换

- **点击** 相机左上角 Logo 区域：循环切换到下一个风格模板
- **长按**（500ms）：打开设置面板并自动滚动到模板区域
- 切换时显示 LCD 复古风格提示：`✨ 2/5 吉卜力风格`（序号/总数 + 模板名）
- 提示 2.5 秒后自动消失
- 切换会播放机械转盘音效（modeSwitch）
- 位置样式：`.camera-logo-btn`（App.css）、`.template-toast`（App.css）

### 多张生成（抽卡模式）

- 在梦想输入表单中可选择同时生成 1-4 张照片
- 按钮组 UI：`1 张`、`2 张`、`3 张`、`4 张`，默认选中 1 张
- 点击生成后，胶片按顺序弹出（每张间隔 600ms）
- 多张胶片位置错开（向右下偏移 30px、20px）
- 并行调用 API 生成，各自独立显影
- 显影音效智能管理：第一张开始时播放，最后一张完成时停止
- 状态：`generateCount`（1-4）、`developingCountRef`（正在显影的胶片计数）
- 防重复机制：`addedHistoryIdsRef` 防止 React 并发模式下历史记录重复添加

### 照片收纳功能

- 画板照片太多时，可以收纳到 Gallery 中
- **拖拽收纳**：拖拽照片到 GALLERY 按钮上松开即可收纳
- **点击收纳**：每张照片右上角有 📥 收纳按钮
- **拖拽提示**：开始拖拽时，GALLERY 按钮变为 "📥 拖到这里收纳"
- **角标显示**：GALLERY 按钮显示已收纳照片数量角标
- **放回画板**：在 Gallery 中点击 📤 按钮可将照片放回画板
- 数据结构：`HistoryItem.isOnCanvas`（true=画板上，false=已收纳）
- 主要函数：`collectPhoto(itemId)`, `restoreToCanvas(itemId)`

### 分享功能

- 点击照片查看大图，底部有「分享」按钮
- 生成精美分享卡片（Canvas 绘制），包含：变装照片、梦想描述、日期、网站水印
- 支持 Web Share API（移动端系统分享）和下载图片
- 主要 API：`generateShareCard()`, `shareImage()`, `downloadImage()`

### 图片查看

- **对比画面**：点击已生成的照片，显示原始照片与变装后照片的左右对比
- **全屏展示**：在对比画面中点击任意图片，可单图全屏展示
- **交互**：点击全屏图片任意位置返回对比画面
- 状态：`fullscreenImage`（当前全屏展示的图片URL）
- 样式：`.fullscreen-overlay`, `.fullscreen-image`（App.css）

### 图片上传处理

- 上传的图片保持原始比例，不进行裁剪
- 仅限制最大边为 1024px，超过时等比缩放
- 输出格式：JPEG，质量 0.9

### 图片本地存储（IndexedDB）

- 生成的图片自动保存到 IndexedDB，避免 CDN URL 过期问题
- 同时保存生成图和原图（key 格式：`{historyId}` 和 `{historyId}-original`）
- 显示时优先从 IndexedDB 加载，无缓存时回退到原始 URL
- 删除历史记录时自动清理对应的 IndexedDB 图片
- 服务：`src/services/image-storage.ts`
- 主要 API：
  - `saveImage(id, url)` - 保存图片
  - `getImage(id)` - 获取图片（返回 blob URL）
  - `deleteImage(id)` - 删除图片
  - `getAllImagesAsBase64()` - 导出所有图片（用于备份）
  - `importImagesFromBase64(images)` - 导入图片（用于恢复）
  - `getStorageInfo()` - 获取存储统计

### 数据导入导出

- 在设置面板底部有「📤 导出数据」和「📥 导入数据」按钮
- 显示本地存储统计：图片数量和估算大小
- 导出为 JSON 文件（版本2），包含：
  - localStorage 数据：历史记录元信息、相机位置、自定义模板、音效设置、API 设置
  - IndexedDB 图片：所有图片转为 base64 嵌入（确保完整备份）
- 导入时自动恢复 localStorage 和 IndexedDB 数据
- 导入后自动提示刷新页面加载数据
- 文件名格式：`dream-dress-backup-YYYY-MM-DD.json`

### 相机拖拽

- 相机可以拖拽到画板任意位置
- 左侧表单、右侧胶片、闪光效果等会自动跟随
- 拖拽范围有限制，保留边距给表单和胶片弹出
- 位置持久化到 localStorage（key: `dream-dress-camera-position`）
- 状态：`cameraPosition`、`isDraggingCamera`、`cameraDragRef`

### 动画效果

- **摄像头光圈动画**：开关摄像头时模拟相机光圈开合效果（6 片叶片）
- **照片进入动画**：上传照片时从底部滑入相机
- **闪光灯效果**：拍照/上传完成时触发闪光
- **胶片弹出动画**：确认生成后胶片从相机弹出
- **显影动画**：胶片从黑色逐渐显现图片
