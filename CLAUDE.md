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
│   └── share.ts            # 分享服务（生成分享卡片、系统分享）
└── constants/dreams.ts     # 提示词模板定义
```

### 核心数据流

1. **拍照/上传** → `capturedPhoto` state → 左侧表单输入梦想
2. **确认生成** → 创建 `FilmPhoto` 对象（带弹出动画）→ 调用 `generateImage` API
3. **显影动画** → `developProgress` 从 0 到 100 → 完成后转为 `HistoryItem` 存入 localStorage

### 关键状态

- `films: FilmPhoto[]` - 正在生成/显影中的胶片（画板上可拖拽）
- `history: HistoryItem[]` - 已完成的照片（持久化到 localStorage）
- 胶片状态流转：`isEjecting` → `isGenerating` → `isDeveloping` → 完成

### API 集成

- 使用 OpenAI 兼容的图像生成 API（默认 `api.tu-zi.com`）
- 支持通过 URL 参数传入 API 配置：`?apiKey=xxx` 或 `?settings={"key":"xxx","url":"xxx"}`
- 模型配置在 `src/types/index.ts` 的 `IMAGE_MODELS` 数组中

### 主题系统

- 使用 CSS 变量实现深浅色主题，定义在 `src/index.css`
- 通过 `@media (prefers-color-scheme: dark)` 自动切换
- 主要变量：`--bg-primary`, `--text-primary`, `--card-bg`, `--border-color` 等

### 音效系统

- 默认使用 Web Audio API 合成音效，支持自定义音频文件替换
- 音效类型：快门、上传、开关摄像头、确认、完成、错误、胶片弹出、显影、点击
- 支持按类别控制开关：快门、相机、操作、反馈、动画、界面音效
- 默认仅开启：快门、相机、动画音效
- 设置持久化到 localStorage（key: `dream-dress-sound-settings`）
- 主要 API：`playSound(type)`, `toggleMasterMute()`, `toggleCategory(category)`

**自定义音效**：将音频文件放到 `public/sounds/` 目录，文件名对应音效类型：
```
shutter.mp3, upload.mp3, cameraOn.mp3, cameraOff.mp3, confirm.mp3,
complete.mp3, error.mp3, eject.mp3, developing.mp3, click.mp3
```
支持格式：mp3、wav、ogg。有自定义文件时优先使用，否则用合成音效。

### 分享功能

- 点击照片查看大图，底部有「分享」按钮
- 生成精美分享卡片（Canvas 绘制），包含：变装照片、梦想描述、日期、网站水印
- 支持 Web Share API（移动端系统分享）和下载图片
- 主要 API：`generateShareCard()`, `shareImage()`, `downloadImage()`

### 动画效果

- **摄像头光圈动画**：开关摄像头时模拟相机光圈开合效果（6 片叶片）
- **照片进入动画**：上传照片时从底部滑入相机
- **闪光灯效果**：拍照/上传完成时触发闪光
- **胶片弹出动画**：确认生成后胶片从相机弹出
- **显影动画**：胶片从黑色逐渐显现图片
