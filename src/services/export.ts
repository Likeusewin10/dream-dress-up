/**
 * 导出服务 - 支持分类导出和智能打包
 */
import JSZip from 'jszip';
import { getAllImagesAsBase64, importImagesFromBase64, type ProgressCallback } from './image-storage';
import { getVirtualMediaList, saveVirtualMediaList, type VirtualMedia } from './virtual-camera';

// 存储 keys
const HISTORY_KEY = 'dream-dress-history';
const CAMERA_POSITION_KEY = 'dream-dress-camera-position';
const TEMPLATES_STORAGE_KEY = 'dream-dress-custom-templates';
const AUTO_TEMPLATES_STORAGE_KEY = 'dream-dress-auto-templates';
const SOUND_SETTINGS_KEY = 'dream-dress-sound-settings';
const SETTINGS_KEY = 'dream-dress-settings';
const VIRTUAL_CAMERA_KEY = 'dream-dress-virtual-camera-enabled';

export type ExportType = 'photos' | 'config' | 'all';

export interface ExportOptions {
  type: ExportType;
  onProgress?: (percent: number, message: string) => void;
}

export interface ConfigData {
  version: number;
  exportTime: string;
  type: 'config';
  data: {
    cameraPosition?: string | null;
    templates?: string | null;
    autoTemplates?: string | null;
    soundSettings?: string | null;
    settings?: string | null;
    virtualCameraEnabled?: string | null;
  };
  virtualMedia?: VirtualMedia[]; // 虚拟摄像头素材
}

export interface PhotosData {
  version: number;
  exportTime: string;
  type: 'photos';
  history: string | null;
  images: Record<string, string>; // base64 图片数据
}

export interface AllData {
  version: number;
  exportTime: string;
  type: 'all';
  config: ConfigData['data'];
  virtualMedia?: VirtualMedia[];
  history: string | null;
  images: Record<string, string>;
}

/**
 * 导出照片
 */
export async function exportPhotos(onProgress?: ProgressCallback): Promise<void> {
  onProgress?.(0, 100, '准备导出照片...');

  // 获取历史记录
  const history = localStorage.getItem(HISTORY_KEY);
  if (!history) {
    throw new Error('没有可导出的照片');
  }

  const historyItems = JSON.parse(history);
  const imageCount = historyItems.length;

  if (imageCount === 0) {
    throw new Error('没有可导出的照片');
  }

  // 获取所有图片
  onProgress?.(10, 100, '正在读取图片...');
  const images = await getAllImagesAsBase64((current, total, msg) => {
    const percent = 10 + (current / total) * 70;
    onProgress?.(Math.round(percent), 100, msg);
  });

  if (imageCount === 1) {
    // 单张照片：直接下载图片
    onProgress?.(90, 100, '正在下载图片...');
    const item = historyItems[0];
    const imageData = images[item.id] || item.resultPhoto;

    // 转换 base64 为 blob 并下载
    const blob = await base64ToBlob(imageData);
    downloadBlob(blob, `dream-dress-${item.dream || 'photo'}-${Date.now()}.png`);
  } else {
    // 多张照片：打包成 zip
    onProgress?.(85, 100, '正在打包...');
    const zip = new JSZip();
    const photosFolder = zip.folder('photos');

    for (let i = 0; i < historyItems.length; i++) {
      const item = historyItems[i];
      const imageData = images[item.id] || item.resultPhoto;
      const blob = await base64ToBlob(imageData);
      const filename = `${i + 1}-${item.dream || 'photo'}.png`.replace(/[/\\?%*:|"<>]/g, '-');
      photosFolder?.file(filename, blob);

      // 也导出原图
      const originalData = images[item.id + '-original'] || item.originalPhoto;
      if (originalData) {
        const originalBlob = await base64ToBlob(originalData);
        photosFolder?.file(`${i + 1}-${item.dream || 'photo'}-original.png`.replace(/[/\\?%*:|"<>]/g, '-'), originalBlob);
      }
    }

    // 添加历史记录 JSON（不含图片数据）
    const historyMeta = historyItems.map((item: any) => ({
      id: item.id,
      name: item.name,
      dream: item.dream,
      timestamp: item.timestamp,
      position: item.position,
      isOnCanvas: item.isOnCanvas,
    }));
    zip.file('history.json', JSON.stringify(historyMeta, null, 2));

    onProgress?.(95, 100, '正在生成压缩包...');
    const content = await zip.generateAsync({ type: 'blob' });
    downloadBlob(content, `dream-dress-photos-${new Date().toISOString().slice(0, 10)}.zip`);
  }

  onProgress?.(100, 100, '导出完成！');
}

/**
 * 导出配置
 */
export async function exportConfig(onProgress?: ProgressCallback): Promise<void> {
  onProgress?.(0, 100, '准备导出配置...');

  const configData: ConfigData = {
    version: 3,
    exportTime: new Date().toISOString(),
    type: 'config',
    data: {
      cameraPosition: localStorage.getItem(CAMERA_POSITION_KEY),
      templates: localStorage.getItem(TEMPLATES_STORAGE_KEY),
      autoTemplates: localStorage.getItem(AUTO_TEMPLATES_STORAGE_KEY),
      soundSettings: localStorage.getItem(SOUND_SETTINGS_KEY),
      settings: localStorage.getItem(SETTINGS_KEY),
      virtualCameraEnabled: localStorage.getItem(VIRTUAL_CAMERA_KEY),
    },
  };

  // 检查虚拟摄像头素材
  const virtualMedia = getVirtualMediaList();
  const hasVirtualMedia = virtualMedia.length > 0;

  if (!hasVirtualMedia) {
    // 无素材：直接下载 JSON
    onProgress?.(50, 100, '正在生成配置文件...');
    const blob = new Blob([JSON.stringify(configData, null, 2)], { type: 'application/json' });
    downloadBlob(blob, `dream-dress-config-${new Date().toISOString().slice(0, 10)}.json`);
  } else {
    // 有素材：打包成 zip
    onProgress?.(30, 100, '正在打包配置和素材...');
    const zip = new JSZip();

    // 添加配置文件（不含素材数据）
    zip.file('config.json', JSON.stringify(configData, null, 2));

    // 添加素材文件夹
    const mediaFolder = zip.folder('virtual-media');
    const mediaIndex: { id: string; type: string; filename: string; duration?: number }[] = [];

    for (let i = 0; i < virtualMedia.length; i++) {
      const media = virtualMedia[i];
      const ext = media.type === 'video' ? 'mp4' : 'png';
      const filename = `${i + 1}-${media.id}.${ext}`;

      onProgress?.(30 + (i / virtualMedia.length) * 60, 100, `正在处理素材 ${i + 1}/${virtualMedia.length}...`);

      const blob = await base64ToBlob(media.dataUrl);
      mediaFolder?.file(filename, blob);

      mediaIndex.push({
        id: media.id,
        type: media.type,
        filename,
        duration: media.duration,
      });
    }

    // 添加素材索引
    zip.file('virtual-media/index.json', JSON.stringify(mediaIndex, null, 2));

    onProgress?.(95, 100, '正在生成压缩包...');
    const content = await zip.generateAsync({ type: 'blob' });
    downloadBlob(content, `dream-dress-config-${new Date().toISOString().slice(0, 10)}.zip`);
  }

  onProgress?.(100, 100, '导出完成！');
}

/**
 * 导出全部数据
 */
export async function exportAll(onProgress?: ProgressCallback): Promise<void> {
  onProgress?.(0, 100, '准备导出所有数据...');

  const zip = new JSZip();

  // 1. 配置数据
  onProgress?.(5, 100, '正在读取配置...');
  const configData = {
    cameraPosition: localStorage.getItem(CAMERA_POSITION_KEY),
    templates: localStorage.getItem(TEMPLATES_STORAGE_KEY),
    autoTemplates: localStorage.getItem(AUTO_TEMPLATES_STORAGE_KEY),
    soundSettings: localStorage.getItem(SOUND_SETTINGS_KEY),
    settings: localStorage.getItem(SETTINGS_KEY),
    virtualCameraEnabled: localStorage.getItem(VIRTUAL_CAMERA_KEY),
  };
  zip.file('config.json', JSON.stringify(configData, null, 2));

  // 2. 虚拟摄像头素材
  const virtualMedia = getVirtualMediaList();
  if (virtualMedia.length > 0) {
    onProgress?.(10, 100, '正在处理虚拟摄像头素材...');
    const mediaFolder = zip.folder('virtual-media');
    const mediaIndex: { id: string; type: string; filename: string; duration?: number }[] = [];

    for (let i = 0; i < virtualMedia.length; i++) {
      const media = virtualMedia[i];
      const ext = media.type === 'video' ? 'mp4' : 'png';
      const filename = `${i + 1}-${media.id}.${ext}`;

      const blob = await base64ToBlob(media.dataUrl);
      mediaFolder?.file(filename, blob);

      mediaIndex.push({
        id: media.id,
        type: media.type,
        filename,
        duration: media.duration,
      });
    }

    zip.file('virtual-media/index.json', JSON.stringify(mediaIndex, null, 2));
  }

  // 3. 历史记录
  onProgress?.(20, 100, '正在读取历史记录...');
  const history = localStorage.getItem(HISTORY_KEY);
  if (history) {
    zip.file('history.json', history);
  }

  // 4. 照片数据
  onProgress?.(25, 100, '正在读取照片...');
  const images = await getAllImagesAsBase64((current, total, msg) => {
    const percent = 25 + (current / total) * 60;
    onProgress?.(Math.round(percent), 100, msg);
  });

  if (Object.keys(images).length > 0) {
    const photosFolder = zip.folder('photos');
    let index = 0;
    const total = Object.keys(images).length;

    for (const [id, base64] of Object.entries(images)) {
      const isOriginal = id.endsWith('-original');
      const filename = isOriginal ? `${id}.png` : `${id}.png`;
      const blob = await base64ToBlob(base64);
      photosFolder?.file(filename, blob);
      index++;
      onProgress?.(85 + (index / total) * 10, 100, `正在打包照片 ${index}/${total}...`);
    }
  }

  // 5. 生成元数据
  const metadata = {
    version: 3,
    exportTime: new Date().toISOString(),
    type: 'all',
    photoCount: Object.keys(images).length,
    virtualMediaCount: virtualMedia.length,
  };
  zip.file('metadata.json', JSON.stringify(metadata, null, 2));

  onProgress?.(95, 100, '正在生成压缩包...');
  const content = await zip.generateAsync({ type: 'blob' });
  downloadBlob(content, `dream-dress-backup-${new Date().toISOString().slice(0, 10)}.zip`);

  onProgress?.(100, 100, '导出完成！');
}

/**
 * 导入数据（自动识别格式）
 */
export async function importData(
  file: File,
  onProgress?: ProgressCallback
): Promise<{ type: string; message: string }> {
  onProgress?.(0, 100, '正在读取文件...');

  const isZip = file.name.endsWith('.zip');

  if (isZip) {
    return importZip(file, onProgress);
  } else {
    return importJson(file, onProgress);
  }
}

/**
 * 导入 ZIP 文件
 */
async function importZip(
  file: File,
  onProgress?: ProgressCallback
): Promise<{ type: string; message: string }> {
  onProgress?.(10, 100, '正在解压...');

  const zip = await JSZip.loadAsync(file);

  // 检查文件类型
  const configFile = zip.file('config.json');
  const historyFile = zip.file('history.json');

  let importedPhotos = 0;
  let importedConfig = false;
  let importedVirtualMedia = 0;

  // 导入配置
  if (configFile) {
    onProgress?.(20, 100, '正在导入配置...');
    const configText = await configFile.async('text');
    const config = JSON.parse(configText);

    // 恢复各项配置到 localStorage
    if (config.cameraPosition) localStorage.setItem(CAMERA_POSITION_KEY, config.cameraPosition);
    if (config.templates) localStorage.setItem(TEMPLATES_STORAGE_KEY, config.templates);
    if (config.autoTemplates) localStorage.setItem(AUTO_TEMPLATES_STORAGE_KEY, config.autoTemplates);
    if (config.soundSettings) localStorage.setItem(SOUND_SETTINGS_KEY, config.soundSettings);
    if (config.settings) localStorage.setItem(SETTINGS_KEY, config.settings);
    if (config.virtualCameraEnabled) localStorage.setItem(VIRTUAL_CAMERA_KEY, config.virtualCameraEnabled);

    importedConfig = true;
  }

  // 导入虚拟摄像头素材
  const mediaIndexFile = zip.file('virtual-media/index.json');
  if (mediaIndexFile) {
    onProgress?.(30, 100, '正在导入虚拟摄像头素材...');
    const indexText = await mediaIndexFile.async('text');
    const mediaIndex = JSON.parse(indexText) as { id: string; type: string; filename: string; duration?: number }[];

    const newMediaList: VirtualMedia[] = [];

    for (let i = 0; i < mediaIndex.length; i++) {
      const item = mediaIndex[i];
      const mediaFile = zip.file(`virtual-media/${item.filename}`);
      if (mediaFile) {
        const blob = await mediaFile.async('blob');
        const dataUrl = await blobToBase64(blob);

        newMediaList.push({
          id: item.id,
          type: item.type as 'image' | 'video',
          dataUrl,
          duration: item.duration,
        });

        importedVirtualMedia++;
        onProgress?.(30 + (i / mediaIndex.length) * 20, 100, `正在导入素材 ${i + 1}/${mediaIndex.length}...`);
      }
    }

    if (newMediaList.length > 0) {
      saveVirtualMediaList(newMediaList);
    }
  }

  // 导入历史记录
  if (historyFile) {
    onProgress?.(50, 100, '正在导入历史记录...');
    const historyText = await historyFile.async('text');
    localStorage.setItem(HISTORY_KEY, historyText);
  }

  // 导入照片
  const photosFolder = zip.folder('photos');
  if (photosFolder) {
    const photoFiles = Object.keys(zip.files).filter(name => name.startsWith('photos/') && !name.endsWith('/'));
    const images: Record<string, string> = {};

    for (let i = 0; i < photoFiles.length; i++) {
      const filename = photoFiles[i];
      const photoFile = zip.file(filename);
      if (photoFile) {
        const blob = await photoFile.async('blob');
        const base64 = await blobToBase64(blob);
        // 从文件名提取 ID
        const id = filename.replace('photos/', '').replace('.png', '');
        images[id] = base64;
        importedPhotos++;
        onProgress?.(50 + (i / photoFiles.length) * 45, 100, `正在导入照片 ${i + 1}/${photoFiles.length}...`);
      }
    }

    if (Object.keys(images).length > 0) {
      await importImagesFromBase64(images);
    }
  }

  onProgress?.(100, 100, '导入完成！');

  const messages: string[] = [];
  if (importedConfig) messages.push('配置');
  if (importedPhotos > 0) messages.push(`${importedPhotos} 张照片`);
  if (importedVirtualMedia > 0) messages.push(`${importedVirtualMedia} 个素材`);

  return {
    type: 'zip',
    message: `成功导入：${messages.join('、')}`,
  };
}

/**
 * 导入 JSON 文件（旧版兼容）
 */
async function importJson(
  file: File,
  onProgress?: ProgressCallback
): Promise<{ type: string; message: string }> {
  onProgress?.(10, 100, '正在解析...');

  const text = await file.text();
  const data = JSON.parse(text);

  if (!data.data && !data.type) {
    throw new Error('无效的备份文件格式');
  }

  // 兼容旧版格式
  if (data.data) {
    onProgress?.(30, 100, '正在导入配置...');
    const { data: configData } = data;

    if (configData.history) localStorage.setItem(HISTORY_KEY, configData.history);
    if (configData.cameraPosition) localStorage.setItem(CAMERA_POSITION_KEY, configData.cameraPosition);
    if (configData.templates) localStorage.setItem(TEMPLATES_STORAGE_KEY, configData.templates);
    if (configData.soundSettings) localStorage.setItem(SOUND_SETTINGS_KEY, configData.soundSettings);
    if (configData.settings) localStorage.setItem(SETTINGS_KEY, configData.settings);

    // 导入图片（如果有）
    if (data.images && Object.keys(data.images).length > 0) {
      onProgress?.(50, 100, '正在导入照片...');
      await importImagesFromBase64(data.images);
    }
  }

  onProgress?.(100, 100, '导入完成！');

  return {
    type: 'json',
    message: '成功导入配置数据',
  };
}

/**
 * 下载 Blob
 */
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Base64 转 Blob
 */
async function base64ToBlob(base64: string): Promise<Blob> {
  // 处理 data URL 格式
  if (base64.startsWith('data:')) {
    const response = await fetch(base64);
    return response.blob();
  }

  // 纯 base64 格式
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray]);
}

/**
 * Blob 转 Base64
 */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
