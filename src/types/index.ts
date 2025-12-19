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
  { id: 'gpt-4o-image', name: 'GPT-4o Image', description: 'OpenAI 多模态图像模型', provider: 'OpenAI' },
  { id: 'gpt-5.1', name: 'GPT-5.1', description: '最新旗舰模型', provider: 'OpenAI' },
  { id: 'gpt-5.1-all', name: 'GPT-5.1 All', description: '全功能版本', provider: 'OpenAI' },
  { id: 'gpt-5', name: 'GPT-5', description: '通用模型', provider: 'OpenAI' },
  { id: 'gpt-5-all', name: 'GPT-5 All', description: '全功能版本', provider: 'OpenAI' },
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
