// Google Analytics 服务 - 尊重用户隐私设置

const GA_ID = import.meta.env.VITE_GA_ID as string | undefined;
const ANALYTICS_CONSENT_KEY = 'dream-dress-analytics-consent';

// 获取用户是否同意统计
export function getAnalyticsConsent(): boolean {
  const stored = localStorage.getItem(ANALYTICS_CONSENT_KEY);
  // 默认为 true（同意），用户可以在设置中关闭
  return stored === null ? true : stored === 'true';
}

// 设置用户统计偏好
export function setAnalyticsConsent(consent: boolean): void {
  localStorage.setItem(ANALYTICS_CONSENT_KEY, String(consent));

  if (consent) {
    initGA();
  } else {
    // 用户关闭统计，禁用 GA
    disableGA();
  }
}

// 检查 GA 是否已加载
function isGALoaded(): boolean {
  return typeof window !== 'undefined' && typeof (window as any).gtag === 'function';
}

// 初始化 Google Analytics
export function initGA(): void {
  if (!GA_ID || !getAnalyticsConsent()) {
    return;
  }

  // 避免重复加载
  if (isGALoaded()) {
    return;
  }

  // 创建 gtag 函数
  (window as any).dataLayer = (window as any).dataLayer || [];
  function gtag(...args: any[]) {
    (window as any).dataLayer.push(args);
  }
  (window as any).gtag = gtag;

  gtag('js', new Date());
  gtag('config', GA_ID, {
    anonymize_ip: true, // 匿名化 IP
    send_page_view: true,
  });

  // 动态加载 GA 脚本
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  document.head.appendChild(script);

  console.log('Google Analytics 已初始化');
}

// 禁用 GA
function disableGA(): void {
  if (GA_ID) {
    // 设置 GA 禁用标志
    (window as any)[`ga-disable-${GA_ID}`] = true;
    console.log('Google Analytics 已禁用');
  }
}

// 发送自定义事件
export function trackEvent(eventName: string, params?: Record<string, any>): void {
  if (!GA_ID || !getAnalyticsConsent() || !isGALoaded()) {
    return;
  }

  (window as any).gtag('event', eventName, params);
}

// 预定义的事件类型
export const AnalyticsEvents = {
  // 拍照相关
  PHOTO_CAPTURE: 'photo_capture',      // 拍照
  PHOTO_UPLOAD: 'photo_upload',        // 上传照片

  // 生成相关
  GENERATE_START: 'generate_start',    // 开始生成
  GENERATE_SUCCESS: 'generate_success', // 生成成功
  GENERATE_FAIL: 'generate_fail',      // 生成失败
  GENERATE_RETRY: 'generate_retry',    // 重试生成

  // 分享相关
  SHARE_CARD: 'share_card',            // 分享卡片
  DOWNLOAD_CARD: 'download_card',      // 下载卡片

  // 模式切换
  MODE_SWITCH: 'mode_switch',          // 自动/手动模式切换
  TEMPLATE_SWITCH: 'template_switch',  // 模板切换

  // 虚拟摄像头
  VIRTUAL_CAMERA_ON: 'virtual_camera_on',
  VIRTUAL_CAMERA_OFF: 'virtual_camera_off',
} as const;

// 检查是否配置了 GA
export function hasGAConfig(): boolean {
  return !!GA_ID;
}
