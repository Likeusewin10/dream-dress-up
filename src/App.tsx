import { useState, useEffect, useCallback, useRef } from 'react';
import { generateImage } from './services/image-api';
import { settingsManager } from './services/settings';
import { generateCustomPrompt, DEFAULT_PROMPT_TEMPLATE } from './constants/dreams';
import { IMAGE_MODELS } from './types';
import './App.css';

// 拍立得照片类型
interface PolaroidPhoto {
  id: string;
  photo: string;
  name: string;
  dream: string;
  date: string;
  result?: string;
  isGenerating?: boolean;
}

// 弹出照片类型
interface EjectedPhoto {
  id: string;
  photo: string;
  date: string;
  isEjecting: boolean;
  isGenerating: boolean;
  result?: string;
  isRevealing: boolean;
  position: { x: number; y: number };
  isDragging: boolean;
}

// 历史记录类型
interface HistoryItem {
  id: string;
  name: string;
  dream: string;
  originalPhoto: string;
  resultPhoto: string;
  timestamp: number;
}

// 本地存储 key
const HISTORY_KEY = 'dream-dress-history';

function App() {
  // 摄像头状态
  const [cameraReady, setCameraReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 弹出的照片（相机上方）
  const [ejectedPhoto, setEjectedPhoto] = useState<EjectedPhoto | null>(null);

  // 拍立得照片列表（右侧）
  const [polaroids, setPolaroids] = useState<PolaroidPhoto[]>([]);
  const [selectedPolaroid, setSelectedPolaroid] = useState<PolaroidPhoto | null>(null);

  // 历史记录
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<HistoryItem | null>(null);

  // API设置
  const [showSettings, setShowSettings] = useState(false);
  const [tempApiUrl, setTempApiUrl] = useState('https://api.tu-zi.com/v1');
  const [tempApiKey, setTempApiKey] = useState('');
  const [tempModel, setTempModel] = useState('gemini-3-pro-image-preview-vip');
  const [tempPrompt, setTempPrompt] = useState(DEFAULT_PROMPT_TEMPLATE);

  // 编辑弹窗
  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDream, setEditDream] = useState('');

  // refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLDivElement>(null);
  const photosSectionRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startX: number; startY: number; offsetX: number; offsetY: number } | null>(null);

  // 加载历史记录和设置
  useEffect(() => {
    try {
      const saved = localStorage.getItem(HISTORY_KEY);
      if (saved) {
        setHistory(JSON.parse(saved));
      }
    } catch (e) {
      console.error('加载历史记录失败', e);
    }

    // 加载设置
    const config = settingsManager.getConfig();
    setTempApiUrl(config.baseUrl);
    setTempApiKey(config.apiKey);
    setTempModel(config.modelName || 'gemini-3-pro-image-preview-vip');
    setTempPrompt(config.customPrompt || DEFAULT_PROMPT_TEMPLATE);
  }, []);

  // 启动摄像头
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 640 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setCameraReady(true);
      }
    } catch (error) {
      console.error('无法访问摄像头:', error);
      setError('无法访问摄像头，请使用上传功能');
    }
  }, []);

  // 初始化摄像头
  useEffect(() => {
    startCamera();
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [startCamera]);

  // 拍照 - 照片从相机弹出
  const takePhoto = useCallback(() => {
    if (!videoRef.current || ejectedPhoto) return;

    const canvas = document.createElement('canvas');
    const video = videoRef.current;
    const size = Math.min(video.videoWidth, video.videoHeight);
    canvas.width = size;
    canvas.height = size;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 裁剪为正方形并镜像
    const offsetX = (video.videoWidth - size) / 2;
    const offsetY = (video.videoHeight - size) / 2;
    ctx.translate(size, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, offsetX, offsetY, size, size, 0, 0, size, size);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    const now = new Date();
    const dateStr = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}`;

    // 创建弹出照片
    const newEjectedPhoto: EjectedPhoto = {
      id: Date.now().toString(),
      photo: dataUrl,
      date: dateStr,
      isEjecting: true,
      isGenerating: false,
      isRevealing: false,
      position: { x: 0, y: 0 },
      isDragging: false,
    };

    setEjectedPhoto(newEjectedPhoto);

    // 弹出动画完成后
    setTimeout(() => {
      setEjectedPhoto(prev => prev ? { ...prev, isEjecting: false } : null);
    }, 800);
  }, [ejectedPhoto]);

  // 上传照片
  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || ejectedPhoto) return;

    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const size = Math.min(img.width, img.height);
        canvas.width = 640;
        canvas.height = 640;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const offsetX = (img.width - size) / 2;
        const offsetY = (img.height - size) / 2;
        ctx.drawImage(img, offsetX, offsetY, size, size, 0, 0, 640, 640);

        const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
        const now = new Date();
        const dateStr = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}`;

        // 创建弹出照片
        const newEjectedPhoto: EjectedPhoto = {
          id: Date.now().toString(),
          photo: dataUrl,
          date: dateStr,
          isEjecting: true,
          isGenerating: false,
          isRevealing: false,
          position: { x: 0, y: 0 },
          isDragging: false,
        };

        setEjectedPhoto(newEjectedPhoto);

        setTimeout(() => {
          setEjectedPhoto(prev => prev ? { ...prev, isEjecting: false } : null);
        }, 800);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }, [ejectedPhoto]);

  // 点击弹出的照片打开编辑弹窗
  const handleEjectedPhotoClick = () => {
    if (ejectedPhoto && !ejectedPhoto.isEjecting && !ejectedPhoto.isDragging) {
      setEditName('');
      setEditDream('');
      setShowEditModal(true);
    }
  };

  // 生成图片
  const handleGenerate = async () => {
    if (!ejectedPhoto || !editDream.trim()) {
      setError('请输入梦想');
      return;
    }

    if (!settingsManager.hasApiKey()) {
      setShowEditModal(false);
      setShowSettings(true);
      return;
    }

    setShowEditModal(false);
    setEjectedPhoto(prev => prev ? { ...prev, isGenerating: true } : null);
    setError(null);

    try {
      const config = settingsManager.getConfig();
      const promptText = generateCustomPrompt(editDream.trim(), config.customPrompt);
      const response = await generateImage(promptText, { image: ejectedPhoto.photo });

      if (response.data?.[0]?.url) {
        const imageUrl = response.data[0].url;

        // 显示揭示动画
        setEjectedPhoto(prev => prev ? {
          ...prev,
          isGenerating: false,
          result: imageUrl,
          isRevealing: true
        } : null);

        // 揭示动画完成后
        setTimeout(() => {
          setEjectedPhoto(prev => prev ? { ...prev, isRevealing: false } : null);
        }, 1000);

        // 保存到历史记录
        const newItem: HistoryItem = {
          id: Date.now().toString(),
          name: editName.trim() || '未命名',
          dream: editDream.trim(),
          originalPhoto: ejectedPhoto.photo,
          resultPhoto: imageUrl,
          timestamp: Date.now(),
        };
        saveHistory([newItem, ...history].slice(0, 50));
      } else {
        throw new Error('生成失败，请重试');
      }
    } catch (e: any) {
      setError(e.message || '生成失败，请重试');
      setEjectedPhoto(prev => prev ? { ...prev, isGenerating: false } : null);
    }
  };

  // 拖拽开始
  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    if (!ejectedPhoto || ejectedPhoto.isEjecting || ejectedPhoto.isGenerating) return;

    e.preventDefault();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    dragRef.current = {
      startX: clientX,
      startY: clientY,
      offsetX: ejectedPhoto.position.x,
      offsetY: ejectedPhoto.position.y,
    };

    setEjectedPhoto(prev => prev ? { ...prev, isDragging: true } : null);
  };

  // 拖拽移动
  const handleDragMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (!dragRef.current || !ejectedPhoto?.isDragging) return;

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    const newX = dragRef.current.offsetX + (clientX - dragRef.current.startX);
    const newY = dragRef.current.offsetY + (clientY - dragRef.current.startY);

    setEjectedPhoto(prev => prev ? {
      ...prev,
      position: { x: newX, y: newY }
    } : null);
  }, [ejectedPhoto?.isDragging]);

  // 拖拽结束
  const handleDragEnd = useCallback(() => {
    if (!ejectedPhoto?.isDragging) return;

    // 检查是否拖到右侧照片区域
    const photosSection = photosSectionRef.current;
    if (photosSection && ejectedPhoto) {
      const rect = photosSection.getBoundingClientRect();
      const photoX = (cameraRef.current?.getBoundingClientRect().left || 0) +
                     (cameraRef.current?.getBoundingClientRect().width || 0) / 2 +
                     ejectedPhoto.position.x;

      if (photoX > rect.left) {
        // 添加到右侧照片列表
        const newPolaroid: PolaroidPhoto = {
          id: ejectedPhoto.id,
          photo: ejectedPhoto.photo,
          name: editName.trim() || '',
          dream: editDream.trim() || '',
          date: ejectedPhoto.date,
          result: ejectedPhoto.result,
        };

        setPolaroids(prev => [newPolaroid, ...prev].slice(0, 6));
        setEjectedPhoto(null);
        setEditName('');
        setEditDream('');
      } else {
        // 弹回原位
        setEjectedPhoto(prev => prev ? {
          ...prev,
          isDragging: false,
          position: { x: 0, y: 0 }
        } : null);
      }
    }

    dragRef.current = null;
  }, [ejectedPhoto, editName, editDream]);

  // 监听全局拖拽事件
  useEffect(() => {
    if (ejectedPhoto?.isDragging) {
      window.addEventListener('mousemove', handleDragMove);
      window.addEventListener('mouseup', handleDragEnd);
      window.addEventListener('touchmove', handleDragMove);
      window.addEventListener('touchend', handleDragEnd);

      return () => {
        window.removeEventListener('mousemove', handleDragMove);
        window.removeEventListener('mouseup', handleDragEnd);
        window.removeEventListener('touchmove', handleDragMove);
        window.removeEventListener('touchend', handleDragEnd);
      };
    }
  }, [ejectedPhoto?.isDragging, handleDragMove, handleDragEnd]);

  // 取消弹出的照片
  const cancelEjectedPhoto = () => {
    setEjectedPhoto(null);
    setEditName('');
    setEditDream('');
  };

  // 删除拍立得
  const deletePolaroid = (id: string) => {
    setPolaroids(prev => prev.filter(p => p.id !== id));
    if (selectedPolaroid?.id === id) {
      setSelectedPolaroid(null);
    }
  };

  // 保存历史记录
  const saveHistory = useCallback((items: HistoryItem[]) => {
    setHistory(items);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(items));
  }, []);

  // 删除历史记录
  const deleteHistoryItem = (id: string) => {
    saveHistory(history.filter(item => item.id !== id));
    if (selectedHistoryItem?.id === id) {
      setSelectedHistoryItem(null);
    }
  };

  // 保存设置
  const handleSaveSettings = () => {
    settingsManager.updateConfig({
      baseUrl: tempApiUrl.trim() || 'https://api.tu-zi.com/v1',
      apiKey: tempApiKey.trim(),
      modelName: tempModel,
      customPrompt: tempPrompt,
    });
    setShowSettings(false);

    // 如果有待生成的照片，继续生成
    if (ejectedPhoto && editDream.trim() && tempApiKey.trim()) {
      handleGenerate();
    }
  };

  // 重置提示词
  const handleResetPrompt = () => {
    setTempPrompt(DEFAULT_PROMPT_TEMPLATE);
  };

  return (
    <div className="app">
      {/* 顶部按钮 */}
      <div className="top-buttons">
        <button className="settings-btn" onClick={() => setShowSettings(true)}>
          SETTINGS
        </button>
        <button className="history-btn" onClick={() => setShowHistory(true)}>
          GALLERY
        </button>
      </div>

      {/* 主区域 - 左右布局 */}
      <main className="main-area">
        {/* 左侧相机区域 */}
        <div className="camera-section" ref={cameraRef}>
          {/* 弹出的照片 */}
          {ejectedPhoto && (
            <div
              className={`ejected-photo ${ejectedPhoto.isEjecting ? 'ejecting' : ''} ${ejectedPhoto.isGenerating ? 'generating' : ''} ${ejectedPhoto.isRevealing ? 'revealing' : ''} ${ejectedPhoto.isDragging ? 'dragging' : ''} ${ejectedPhoto.result ? 'has-result' : ''}`}
              style={{
                transform: `translate(${ejectedPhoto.position.x}px, ${ejectedPhoto.position.y}px)`,
              }}
              onMouseDown={handleDragStart}
              onTouchStart={handleDragStart}
              onClick={handleEjectedPhotoClick}
            >
              <div className="ejected-photo-inner">
                {/* 原始照片 */}
                <div className={`ejected-photo-original ${ejectedPhoto.result ? 'hidden' : ''}`}>
                  <img src={ejectedPhoto.photo} alt="照片" />
                </div>
                {/* AI生成结果 */}
                {ejectedPhoto.result && (
                  <div className={`ejected-photo-result ${ejectedPhoto.isRevealing ? 'revealing' : ''}`}>
                    <img src={ejectedPhoto.result} alt="AI生成" />
                  </div>
                )}
                {/* 生成中指示器 */}
                {ejectedPhoto.isGenerating && (
                  <div className="ejected-photo-loading">
                    <div className="spinner-small"></div>
                    <span>AI生成中...</span>
                  </div>
                )}
              </div>
              <div className="ejected-photo-info">
                <span className="ejected-photo-date">{ejectedPhoto.date}</span>
                {!ejectedPhoto.isGenerating && !ejectedPhoto.result && (
                  <span className="ejected-photo-hint">点击编辑</span>
                )}
                {ejectedPhoto.result && (
                  <span className="ejected-photo-hint">拖动到右侧</span>
                )}
              </div>
              {/* 取消按钮 */}
              {!ejectedPhoto.isGenerating && (
                <button
                  className="ejected-photo-cancel"
                  onClick={(e) => {
                    e.stopPropagation();
                    cancelEjectedPhoto();
                  }}
                >
                  ✕
                </button>
              )}
            </div>
          )}

          <div className="camera-body">
            {/* 闪光灯 */}
            <div className="camera-flash"></div>

            {/* 取景器 */}
            <div className="camera-viewfinder"></div>

            {/* 小镜头 */}
            <div className="camera-small-lens"></div>

            {/* 主镜头 - 包含视频 */}
            <div className="camera-lens-outer">
              <div className="camera-lens-inner">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="camera-video"
                />
                {!cameraReady && (
                  <div className="camera-placeholder">
                    <span>📷</span>
                  </div>
                )}
              </div>
            </div>

            {/* 拍照按钮 */}
            <button
              className="camera-shutter"
              onClick={takePhoto}
              disabled={!!ejectedPhoto}
            >
              <div className="shutter-inner"></div>
            </button>

            {/* 上传按钮 */}
            <button
              className="camera-upload"
              onClick={() => fileInputRef.current?.click()}
              disabled={!!ejectedPhoto}
            >
              📁
            </button>

            {/* 照片出口 */}
            <div className="camera-output"></div>
          </div>
        </div>

        {/* 右侧拍立得照片区域 */}
        <div className="photos-section" ref={photosSectionRef}>
          <div className="polaroids-area">
            {polaroids.length === 0 ? (
              <div className="polaroids-empty">
                <span>📸</span>
                <p>拍照后拖动照片到此处</p>
              </div>
            ) : (
              polaroids.map((polaroid, index) => (
                <div
                  key={polaroid.id}
                  className={`polaroid ${selectedPolaroid?.id === polaroid.id ? 'selected' : ''}`}
                  style={{
                    transform: `rotate(${(index % 2 === 0 ? 1 : -1) * (3 + index * 2)}deg)`,
                    zIndex: polaroids.length - index,
                  }}
                  onClick={() => setSelectedPolaroid(polaroid)}
                >
                  <div className="polaroid-image">
                    {polaroid.result ? (
                      <img src={polaroid.result} alt="结果" />
                    ) : (
                      <img src={polaroid.photo} alt="照片" />
                    )}
                  </div>
                  <div className="polaroid-info">
                    <span className="polaroid-dream">{polaroid.dream || 'MAY I MEET YOU'}</span>
                    <span className="polaroid-date">{polaroid.date}</span>
                  </div>
                  <button
                    className="polaroid-delete"
                    onClick={(e) => {
                      e.stopPropagation();
                      deletePolaroid(polaroid.id);
                    }}
                  >
                    ✕
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </main>

      {/* 隐藏的文件输入 */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileUpload}
        style={{ display: 'none' }}
      />

      {/* 错误提示 */}
      {error && (
        <div className="error-toast" onClick={() => setError(null)}>
          {error}
        </div>
      )}

      {/* 编辑弹窗 */}
      {showEditModal && ejectedPhoto && (
        <div className="polaroid-modal" onClick={() => setShowEditModal(false)}>
          <div className="polaroid-modal-content" onClick={e => e.stopPropagation()}>
            <button className="btn-close" onClick={() => setShowEditModal(false)}>✕</button>

            <div className="polaroid-preview">
              <img src={ejectedPhoto.photo} alt="照片" />
            </div>

            <div className="polaroid-form">
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="输入姓名（可选）"
                className="input-name"
              />
              <textarea
                value={editDream}
                onChange={(e) => setEditDream(e.target.value)}
                placeholder="输入你的梦想..."
                className="input-dream"
                rows={2}
              />
              <div className="polaroid-actions">
                <button
                  className="btn-primary"
                  onClick={handleGenerate}
                  disabled={!editDream.trim()}
                >
                  开始变装 ✨
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 查看拍立得详情弹窗 */}
      {selectedPolaroid && (
        <div className="polaroid-modal" onClick={() => setSelectedPolaroid(null)}>
          <div className="polaroid-modal-content" onClick={e => e.stopPropagation()}>
            <button className="btn-close" onClick={() => setSelectedPolaroid(null)}>✕</button>

            <div className="polaroid-preview">
              {selectedPolaroid.result ? (
                <img src={selectedPolaroid.result} alt="结果" />
              ) : (
                <img src={selectedPolaroid.photo} alt="照片" />
              )}
            </div>

            <div className="polaroid-form">
              <div className="polaroid-view-info">
                <p className="view-name">{selectedPolaroid.name || '未命名'}</p>
                <p className="view-dream">"{selectedPolaroid.dream || '无梦想'}"</p>
                <p className="view-date">{selectedPolaroid.date}</p>
              </div>
              {selectedPolaroid.result && (
                <div className="polaroid-actions">
                  <a
                    href={selectedPolaroid.result}
                    download={`${selectedPolaroid.name || '梦想变装'}.png`}
                    className="btn-download"
                  >
                    📥 保存图片
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 历史记录画廊 */}
      {showHistory && (
        <div className="gallery-overlay" onClick={() => setShowHistory(false)}>
          <div className="gallery-container" onClick={(e) => e.stopPropagation()}>
            <div className="gallery-header">
              <h2>📚 梦想画廊</h2>
              <button className="btn-close" onClick={() => setShowHistory(false)}>✕</button>
            </div>
            {history.length === 0 ? (
              <div className="gallery-empty">
                <span>🖼️</span>
                <p>还没有记录哦，快去拍照吧！</p>
              </div>
            ) : (
              <div className="gallery-grid">
                {history.map((item) => (
                  <div
                    key={item.id}
                    className="gallery-item"
                    onClick={() => setSelectedHistoryItem(item)}
                  >
                    <img src={item.resultPhoto} alt={item.name} />
                    <div className="gallery-item-info">
                      <span className="gallery-item-name">{item.name}</span>
                    </div>
                    <button
                      className="gallery-item-delete"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteHistoryItem(item.id);
                      }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 设置弹窗 */}
      {showSettings && (
        <div className="settings-overlay" onClick={() => setShowSettings(false)}>
          <div className="settings-container" onClick={(e) => e.stopPropagation()}>
            <div className="settings-header">
              <h2>⚙️ 设置</h2>
              <button className="btn-close" onClick={() => setShowSettings(false)}>✕</button>
            </div>
            <div className="settings-form">
              <div className="settings-field">
                <label>API 地址</label>
                <input
                  type="text"
                  value={tempApiUrl}
                  onChange={(e) => setTempApiUrl(e.target.value)}
                  placeholder="https://api.tu-zi.com/v1"
                  className="input-name"
                />
              </div>
              <div className="settings-field">
                <label>API Key</label>
                <input
                  type="password"
                  value={tempApiKey}
                  onChange={(e) => setTempApiKey(e.target.value)}
                  placeholder="输入你的 API Key"
                  className="input-name"
                />
                <p className="settings-hint">
                  获取地址: <a href="https://api.tu-zi.com/token" target="_blank" rel="noopener noreferrer">https://api.tu-zi.com/token</a>
                </p>
              </div>
              <div className="settings-field">
                <label>模型</label>
                <select
                  value={tempModel}
                  onChange={(e) => setTempModel(e.target.value)}
                  className="input-select"
                >
                  {IMAGE_MODELS.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.name} - {model.description}
                    </option>
                  ))}
                </select>
              </div>
              <div className="settings-field">
                <label>
                  提示词模板
                  <button className="btn-reset" onClick={handleResetPrompt}>重置</button>
                </label>
                <textarea
                  value={tempPrompt}
                  onChange={(e) => setTempPrompt(e.target.value)}
                  placeholder="输入提示词模板，使用 {dream} 作为梦想占位符"
                  className="input-prompt"
                  rows={6}
                />
                <p className="settings-hint">
                  使用 <code>{'{dream}'}</code> 作为用户输入梦想的占位符
                </p>
              </div>
              <button
                className="btn-primary"
                onClick={handleSaveSettings}
              >
                保存设置
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 图片详情弹窗 */}
      {selectedHistoryItem && (
        <div className="detail-overlay" onClick={() => setSelectedHistoryItem(null)}>
          <div className="detail-container" onClick={(e) => e.stopPropagation()}>
            <button className="btn-close" onClick={() => setSelectedHistoryItem(null)}>✕</button>
            <div className="detail-images">
              <div className="detail-image-box">
                <span className="detail-label">原始照片</span>
                <img src={selectedHistoryItem.originalPhoto} alt="原始" />
              </div>
              <div className="detail-image-box">
                <span className="detail-label">变装后</span>
                <img src={selectedHistoryItem.resultPhoto} alt="变装后" />
              </div>
            </div>
            <div className="detail-info">
              <p className="detail-name">{selectedHistoryItem.name}</p>
              <p className="detail-dream">"{selectedHistoryItem.dream}"</p>
              <p className="detail-time">{new Date(selectedHistoryItem.timestamp).toLocaleString()}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
