/**
 * 类型定义
 */

// API 配置
export interface ApiConfig {
  apiKey: string;
  baseUrl: string;
  modelName?: string;
  timeout?: number;
  customPrompt?: string;
}

// 图像生成模型
export interface ImageModel {
  id: string;
  name: string;
  description: string;
  provider: string;
}

// 预定义的图像生成模型列表
export const IMAGE_MODELS: ImageModel[] = [
  { id: 'gemini-3-pro-image-preview-vip', name: 'Gemini 3 Pro Image VIP', description: 'Google 图像生成模型 (VIP)', provider: 'Google' },
  { id: 'gemini-3-pro-image-preview-2k', name: 'Gemini 3 Pro Image 2K', description: 'Google 图像生成模型 (2K分辨率)', provider: 'Google' },
  { id: 'gemini-3-pro-image-preview', name: 'Gemini 3 Pro Image', description: 'Google 图像生成模型', provider: 'Google' },
];

// 职业/梦想类型
export interface Dream {
  id: string;
  name: string;
  nameEn: string;
  icon: string;
  prompt: string;
}

// 生成状态
export type GenerationStatus = 'idle' | 'uploading' | 'generating' | 'success' | 'error';

// 生成结果
export interface GenerationResult {
  imageUrl: string;
  dream: Dream;
  originalPhoto: string;
}

// 虚拟摄像头素材类型
export interface VirtualMedia {
  id: string;
  type: 'image' | 'video';
  dataUrl: string;  // base64 data URL
  thumbnail?: string;  // 缩略图（视频用）
  duration?: number;  // 视频时长（秒）
}
