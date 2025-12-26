/**
 * 简化的设置管理器
 * 从 aitu 项目适配
 */

import type { ApiConfig } from '../types';

const STORAGE_KEY = 'dream-dress-settings';

// 从环境变量读取默认配置
const ENV_API_URL = import.meta.env.VITE_API_URL as string | undefined;
const ENV_API_MODEL = import.meta.env.VITE_API_MODEL as string | undefined;

// 默认配置
const DEFAULT_CONFIG: ApiConfig = {
  apiKey: '',
  baseUrl: ENV_API_URL || 'https://api.tu-zi.com/v1',
  modelName: ENV_API_MODEL || 'gemini-3-pro-image-preview-vip',
  timeout: 10 * 60 * 1000, // 10分钟
};

/**
 * 设置管理器
 */
class SettingsManager {
  private config: ApiConfig;

  constructor() {
    this.config = this.loadSettings();
    this.initializeFromUrl();
  }

  /**
   * 从本地存储加载设置
   */
  private loadSettings(): ApiConfig {
    if (typeof window === 'undefined') {
      return { ...DEFAULT_CONFIG };
    }

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return { ...DEFAULT_CONFIG, ...parsed };
      }
    } catch (error) {
      console.warn('Failed to load settings:', error);
    }

    return { ...DEFAULT_CONFIG };
  }

  /**
   * 从URL参数初始化设置
   */
  private initializeFromUrl(): void {
    if (typeof window === 'undefined') return;

    try {
      const urlParams = new URLSearchParams(window.location.search);

      // 处理 settings 参数
      const settingsParam = urlParams.get('settings');
      if (settingsParam) {
        const decoded = decodeURIComponent(settingsParam);
        const urlSettings = JSON.parse(decoded);

        if (urlSettings.key) {
          this.config.apiKey = urlSettings.key;
        }
        if (urlSettings.url) {
          this.config.baseUrl = urlSettings.url;
        }
        this.saveSettings();
      }

      // 处理 apiKey 参数
      const apiKey = urlParams.get('apiKey');
      if (apiKey) {
        this.config.apiKey = apiKey;
        this.saveSettings();
      }

      // 清除URL参数
      if (settingsParam || apiKey) {
        const url = new URL(window.location.href);
        url.searchParams.delete('settings');
        url.searchParams.delete('apiKey');
        window.history.replaceState({}, document.title, url.toString());
      }
    } catch (error) {
      console.warn('Failed to initialize settings from URL:', error);
    }
  }

  /**
   * 保存设置到本地存储
   */
  private saveSettings(): void {
    if (typeof window === 'undefined') return;

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.config));
    } catch (error) {
      console.warn('Failed to save settings:', error);
    }
  }

  /**
   * 获取当前配置
   */
  getConfig(): ApiConfig {
    return { ...this.config };
  }

  /**
   * 更新配置
   */
  updateConfig(updates: Partial<ApiConfig>): void {
    this.config = { ...this.config, ...updates };
    this.saveSettings();
  }

  /**
   * 检查是否已配置 API Key
   */
  hasApiKey(): boolean {
    return !!this.config.apiKey;
  }
}

// 导出单例
export const settingsManager = new SettingsManager();
