/**
 * 虚拟摄像头服务
 * 管理虚拟摄像头素材的存储和播放
 */

import type { VirtualMedia } from '../types';

const STORAGE_KEY = 'dream-dress-virtual-camera';
const ENABLED_KEY = 'dream-dress-virtual-camera-enabled';
const IMAGE_INTERVAL = 3000; // 图片轮播间隔 3 秒

/**
 * 获取虚拟摄像头是否启用
 */
export function isVirtualCameraEnabled(): boolean {
  try {
    const saved = localStorage.getItem(ENABLED_KEY);
    return saved === 'true';
  } catch {
    return false;
  }
}

/**
 * 设置虚拟摄像头启用状态
 */
export function setVirtualCameraEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(ENABLED_KEY, String(enabled));
  } catch (e) {
    console.error('保存虚拟摄像头设置失败', e);
  }
}

/**
 * 获取素材列表
 */
export function getVirtualMediaList(): VirtualMedia[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved) as VirtualMedia[];
    }
  } catch (e) {
    console.error('加载虚拟摄像头素材失败', e);
  }
  return [];
}

/**
 * 保存素材列表
 */
export function saveVirtualMediaList(list: VirtualMedia[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch (e) {
    console.error('保存虚拟摄像头素材失败', e);
  }
}

/**
 * 添加素材
 */
export function addVirtualMedia(media: VirtualMedia): VirtualMedia[] {
  const list = getVirtualMediaList();
  list.push(media);
  saveVirtualMediaList(list);
  return list;
}

/**
 * 删除素材
 */
export function removeVirtualMedia(id: string): VirtualMedia[] {
  const list = getVirtualMediaList().filter(m => m.id !== id);
  saveVirtualMediaList(list);
  return list;
}

/**
 * 处理上传的文件，转换为 VirtualMedia
 */
export async function processMediaFile(file: File): Promise<VirtualMedia | null> {
  return new Promise((resolve) => {
    const isVideo = file.type.startsWith('video/');
    const reader = new FileReader();

    reader.onload = async () => {
      const dataUrl = reader.result as string;
      const id = `vm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      if (isVideo) {
        // 处理视频：获取时长和缩略图
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.src = dataUrl;

        video.onloadedmetadata = () => {
          const duration = video.duration;

          // 获取第一帧作为缩略图
          video.currentTime = 0;
          video.onseeked = () => {
            const canvas = document.createElement('canvas');
            canvas.width = 160;
            canvas.height = 120;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              const thumbnail = canvas.toDataURL('image/jpeg', 0.6);
              resolve({
                id,
                type: 'video',
                dataUrl,
                thumbnail,
                duration,
              });
            } else {
              resolve({
                id,
                type: 'video',
                dataUrl,
                duration,
              });
            }
          };
        };

        video.onerror = () => {
          console.error('视频加载失败');
          resolve(null);
        };
      } else {
        // 处理图片：压缩到合适尺寸
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const maxSize = 1024;
          let width = img.width;
          let height = img.height;

          if (width > maxSize || height > maxSize) {
            if (width > height) {
              height = Math.round(height * maxSize / width);
              width = maxSize;
            } else {
              width = Math.round(width * maxSize / height);
              height = maxSize;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.9);
            resolve({
              id,
              type: 'image',
              dataUrl: compressedDataUrl,
            });
          } else {
            resolve({
              id,
              type: 'image',
              dataUrl,
            });
          }
        };
        img.onerror = () => {
          console.error('图片加载失败');
          resolve(null);
        };
        img.src = dataUrl;
      }
    };

    reader.onerror = () => {
      console.error('文件读取失败');
      resolve(null);
    };

    reader.readAsDataURL(file);
  });
}

/**
 * 从视频元素截取当前帧
 */
export function captureVideoFrame(video: HTMLVideoElement): string | null {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || video.clientWidth;
    canvas.height = video.videoHeight || video.clientHeight;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/jpeg', 0.9);
    }
  } catch (e) {
    console.error('截取视频帧失败', e);
  }
  return null;
}

export { IMAGE_INTERVAL };
