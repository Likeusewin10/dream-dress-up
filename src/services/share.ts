// 分享服务 - 生成分享卡片并调用系统分享

export interface ShareCardData {
  name: string;
  dream: string;
  resultPhoto: string;
  timestamp: number;
}

// 加载图片
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// 生成分享卡片
export async function generateShareCard(data: ShareCardData): Promise<Blob> {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;

  // 卡片尺寸（适合手机分享）
  const cardWidth = 720;
  const cardHeight = 960;
  const padding = 40;
  const imageSize = cardWidth - padding * 2;

  canvas.width = cardWidth;
  canvas.height = cardHeight;

  // 背景渐变
  const gradient = ctx.createLinearGradient(0, 0, 0, cardHeight);
  gradient.addColorStop(0, '#fef9f3');
  gradient.addColorStop(1, '#fff5eb');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, cardWidth, cardHeight);

  // 装饰边框
  ctx.strokeStyle = '#e8ddd4';
  ctx.lineWidth = 2;
  ctx.strokeRect(20, 20, cardWidth - 40, cardHeight - 40);

  // 顶部装饰线（贯通整个边框）
  ctx.strokeStyle = '#d4c4b5';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(20, 80);
  ctx.lineTo(cardWidth - 20, 80);
  ctx.stroke();

  // 标题
  ctx.fillStyle = '#5a4a3a';
  ctx.font = 'bold 28px "PingFang SC", "Microsoft YaHei", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('梦想变装', cardWidth / 2, 60);

  // 加载并绘制图片
  try {
    const img = await loadImage(data.resultPhoto);

    // 图片区域（正方形，居中裁剪）
    const imgY = 100;

    // 绘制图片阴影
    ctx.shadowColor = 'rgba(0, 0, 0, 0.15)';
    ctx.shadowBlur = 20;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 5;

    // 绘制图片背景（白色边框效果）
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(padding - 10, imgY - 10, imageSize + 20, imageSize + 20);

    // 重置阴影
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    // 计算裁剪区域（居中裁剪为正方形）
    const srcSize = Math.min(img.width, img.height);
    const srcX = (img.width - srcSize) / 2;
    const srcY = (img.height - srcSize) / 2;

    // 绘制图片
    ctx.drawImage(img, srcX, srcY, srcSize, srcSize, padding, imgY, imageSize, imageSize);

    // 图片边框
    ctx.strokeStyle = '#e0d5c8';
    ctx.lineWidth = 1;
    ctx.strokeRect(padding, imgY, imageSize, imageSize);

  } catch (e) {
    console.error('加载图片失败:', e);
    // 绘制占位符
    ctx.fillStyle = '#f0e8e0';
    ctx.fillRect(padding, 100, imageSize, imageSize);
    ctx.fillStyle = '#a0908080';
    ctx.font = '24px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('图片加载失败', cardWidth / 2, 100 + imageSize / 2);
  }

  // 底部信息区域
  let infoY = 100 + imageSize + 40;

  // 名字（仅当有有效名字时显示，排除空字符串和"未命名"）
  const hasName = data.name && data.name.trim() !== '' && data.name.trim() !== '未命名';
  if (hasName) {
    ctx.fillStyle = '#3a3a3a';
    ctx.font = 'bold 32px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(data.name, cardWidth / 2, infoY);
    infoY += 45; // 名字占用的空间
  }

  // 梦想描述
  ctx.fillStyle = '#6a5a4a';
  ctx.font = '24px "PingFang SC", "Microsoft YaHei", sans-serif';
  const dreamText = `"${data.dream}"`;

  // 文字换行处理
  const maxWidth = cardWidth - padding * 2;
  const lines = wrapText(ctx, dreamText, maxWidth);
  lines.forEach((line, index) => {
    ctx.fillText(line, cardWidth / 2, infoY + index * 32);
  });

  // 底部日期和水印（保持在边框内，边框底部在 cardHeight - 40 = 920）
  const bottomY = cardHeight - 75;
  ctx.fillStyle = '#a09080';
  ctx.font = '18px "PingFang SC", "Microsoft YaHei", sans-serif';
  ctx.textAlign = 'center';

  const dateStr = new Date(data.timestamp).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  ctx.fillText(dateStr, cardWidth / 2, bottomY);

  // 水印（网站域名）
  ctx.fillStyle = '#8a7a6a';
  ctx.font = 'bold 20px "PingFang SC", "Microsoft YaHei", sans-serif';
  const domain = window.location.host || 'dream-dress-up';
  ctx.fillText(`🌟 ${domain}`, cardWidth / 2, bottomY + 28);

  // 转换为 Blob
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error('生成图片失败'));
      }
    }, 'image/png', 0.95);
  });
}

// 文字换行
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let currentLine = '';

  for (const char of text) {
    const testLine = currentLine + char;
    const metrics = ctx.measureText(testLine);

    if (metrics.width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = char;
    } else {
      currentLine = testLine;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines.slice(0, 3); // 最多3行
}

// 下载图片
export function downloadImage(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// 获取分享链接
export function getShareLink(): string {
  return window.location.origin + window.location.pathname;
}

// 复制链接到剪贴板
export async function copyLink(): Promise<boolean> {
  const link = getShareLink();
  try {
    await navigator.clipboard.writeText(link);
    return true;
  } catch {
    // 降级方案
    const textarea = document.createElement('textarea');
    textarea.value = link;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const success = document.execCommand('copy');
    document.body.removeChild(textarea);
    return success;
  }
}

// 检查是否支持 Web Share API
export function canShare(): boolean {
  return !!navigator.share && !!navigator.canShare;
}

// 使用 Web Share API 分享
export async function shareImage(blob: Blob, data: ShareCardData): Promise<boolean> {
  const file = new File([blob], `dream-dress-${Date.now()}.png`, { type: 'image/png' });

  const shareData: ShareData = {
    title: '梦想变装',
    text: `${data.name}的梦想：${data.dream}`,
    files: [file],
  };

  // 检查是否支持分享文件
  if (navigator.canShare && !navigator.canShare(shareData)) {
    // 不支持分享文件，尝试只分享文本
    delete shareData.files;
  }

  try {
    await navigator.share(shareData);
    return true;
  } catch (e) {
    if ((e as Error).name === 'AbortError') {
      // 用户取消分享
      return false;
    }
    throw e;
  }
}
