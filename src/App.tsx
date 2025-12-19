import { useState, useEffect, useCallback, useRef } from 'react';
import { generateImage } from './services/image-api';
import { settingsManager } from './services/settings';
import { generateCustomPrompt, DEFAULT_PROMPT_TEMPLATE } from './constants/dreams';
import { IMAGE_MODELS } from './types';
import './App.css';

// 胶片/照片类型（在画板上）
interface FilmPhoto {
  id: string;
  originalPhoto: string;
  name: string;
  dream: string;
  date: string;
  result?: string;
  isGenerating: boolean;
  isDeveloping: boolean;
  developProgress: number;
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

  // 待确认的照片（拍照后弹窗编辑）
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDream, setEditDream] = useState('');

  // 画板上的胶片/照片列表
  const [films, setFilms] = useState<FilmPhoto[]>([]);

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

  // refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ id: string; startX: number; startY: number; offsetX: number; offsetY: number } | null>(null);

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

  // 拍照 - 只捕获照片，弹窗确认
  const takePhoto = useCallback(() => {
    if (!videoRef.current || capturedPhoto) return;

    const canvas = document.createElement('canvas');
    const video = videoRef.current;
    const size = Math.min(video.videoWidth, video.videoHeight);
    canvas.width = size;
    canvas.height = size;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const offsetX = (video.videoWidth - size) / 2;
    const offsetY = (video.videoHeight - size) / 2;
    ctx.translate(size, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, offsetX, offsetY, size, size, 0, 0, size, size);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    setCapturedPhoto(dataUrl);
    setEditName('');
    setEditDream('');
  }, [capturedPhoto]);

  // 上传照片
  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || capturedPhoto) return;

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
        setCapturedPhoto(dataUrl);
        setEditName('');
        setEditDream('');
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }, [capturedPhoto]);

  // 确认并开始生成 - 弹出黑色胶片
  const handleConfirmAndGenerate = async () => {
    if (!capturedPhoto || !editDream.trim()) {
      setError('请输入梦想');
      return;
    }

    if (!settingsManager.hasApiKey()) {
      setShowSettings(true);
      return;
    }

    const now = new Date();
    const dateStr = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}`;

    // 创建新胶片（黑色状态）
    const newFilm: FilmPhoto = {
      id: Date.now().toString(),
      originalPhoto: capturedPhoto,
      name: editName.trim(),
      dream: editDream.trim(),
      date: dateStr,
      isGenerating: true,
      isDeveloping: false,
      developProgress: 0,
      position: { x: 50 + Math.random() * 100, y: 50 + Math.random() * 50 },
      isDragging: false,
    };

    setFilms(prev => [...prev, newFilm]);
    setCapturedPhoto(null);
    setEditName('');
    setEditDream('');
    setError(null);

    // 开始AI生成
    try {
      const config = settingsManager.getConfig();
      const promptText = generateCustomPrompt(newFilm.dream, config.customPrompt);
      const response = await generateImage(promptText, { image: newFilm.originalPhoto });

      if (response.data?.[0]?.url) {
        const imageUrl = response.data[0].url;

        // 保存到历史记录
        const newItem: HistoryItem = {
          id: Date.now().toString(),
          name: newFilm.name || '未命名',
          dream: newFilm.dream,
          originalPhoto: newFilm.originalPhoto,
          resultPhoto: imageUrl,
          timestamp: Date.now(),
        };
        saveHistory([newItem, ...history].slice(0, 50));

        // 开始显影动画
        setFilms(prev => prev.map(f =>
          f.id === newFilm.id
            ? { ...f, result: imageUrl, isGenerating: false, isDeveloping: true }
            : f
        ));

        // 显影动画（逐渐显示）
        let progress = 0;
        const developInterval = setInterval(() => {
          progress += 2;
          setFilms(prev => prev.map(f =>
            f.id === newFilm.id
              ? { ...f, developProgress: Math.min(progress, 100) }
              : f
          ));
          if (progress >= 100) {
            clearInterval(developInterval);
            setFilms(prev => prev.map(f =>
              f.id === newFilm.id
                ? { ...f, isDeveloping: false }
                : f
            ));
          }
        }, 50);

      } else {
        throw new Error('生成失败，请重试');
      }
    } catch (e: any) {
      setError(e.message || '生成失败，请重试');
      // 移除失败的胶片
      setFilms(prev => prev.filter(f => f.id !== newFilm.id));
    }
  };

  // 取消拍照
  const cancelCapture = () => {
    setCapturedPhoto(null);
    setEditName('');
    setEditDream('');
  };

  // 拖拽开始
  const handleDragStart = (e: React.MouseEvent | React.TouchEvent, filmId: string) => {
    const film = films.find(f => f.id === filmId);
    if (!film) return;

    e.preventDefault();
    e.stopPropagation();

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    dragRef.current = {
      id: filmId,
      startX: clientX,
      startY: clientY,
      offsetX: film.position.x,
      offsetY: film.position.y,
    };

    setFilms(prev => prev.map(f =>
      f.id === filmId ? { ...f, isDragging: true } : f
    ));
  };

  // 拖拽移动
  const handleDragMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (!dragRef.current) return;

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    const newX = dragRef.current.offsetX + (clientX - dragRef.current.startX);
    const newY = dragRef.current.offsetY + (clientY - dragRef.current.startY);

    setFilms(prev => prev.map(f =>
      f.id === dragRef.current?.id
        ? { ...f, position: { x: newX, y: newY } }
        : f
    ));
  }, []);

  // 拖拽结束
  const handleDragEnd = useCallback(() => {
    if (!dragRef.current) return;

    setFilms(prev => prev.map(f =>
      f.id === dragRef.current?.id ? { ...f, isDragging: false } : f
    ));

    dragRef.current = null;
  }, []);

  // 监听全局拖拽事件
  useEffect(() => {
    const hasDragging = films.some(f => f.isDragging);
    if (hasDragging) {
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
  }, [films, handleDragMove, handleDragEnd]);

  // 删除胶片
  const deleteFilm = (id: string) => {
    setFilms(prev => prev.filter(f => f.id !== id));
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

      {/* 主区域 - 画板背景 */}
      <main className="canvas-area" ref={canvasRef}>
        {/* 相机 */}
        <div className="camera-section">
          <div className="camera-body">
            <div className="camera-flash"></div>
            <div className="camera-viewfinder"></div>
            <div className="camera-small-lens"></div>

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

            <button
              className="camera-shutter"
              onClick={takePhoto}
              disabled={!!capturedPhoto}
            >
              <div className="shutter-inner"></div>
            </button>

            <button
              className="camera-upload"
              onClick={() => fileInputRef.current?.click()}
              disabled={!!capturedPhoto}
            >
              📁
            </button>

            <div className="camera-output"></div>
          </div>
        </div>

        {/* 画板上的胶片/照片 */}
        {films.map((film) => (
          <div
            key={film.id}
            className={`film-card ${film.isDragging ? 'dragging' : ''} ${film.isGenerating ? 'generating' : ''} ${film.isDeveloping ? 'developing' : ''}`}
            style={{
              left: film.position.x,
              top: film.position.y,
            }}
            onMouseDown={(e) => handleDragStart(e, film.id)}
            onTouchStart={(e) => handleDragStart(e, film.id)}
          >
            <div className="film-image">
              {/* 黑色胶片底层 */}
              <div className="film-black"></div>

              {/* 显影中的照片 */}
              {film.result && (
                <div
                  className="film-photo"
                  style={{ opacity: film.developProgress / 100 }}
                >
                  <img src={film.result} alt="照片" />
                </div>
              )}

              {/* 生成中提示 */}
              {film.isGenerating && (
                <div className="film-loading">
                  <span>显影中...</span>
                </div>
              )}
            </div>
            <div className="film-info">
              <span className="film-dream">{film.dream}</span>
              <span className="film-date">{film.date}</span>
            </div>
            {/* 删除按钮 */}
            {!film.isGenerating && (
              <button
                className="film-delete"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteFilm(film.id);
                }}
              >
                ✕
              </button>
            )}
          </div>
        ))}

        {/* 空提示 */}
        {films.length === 0 && (
          <div className="canvas-hint">
            <span>📸</span>
            <p>拍照后胶片会出现在这里</p>
          </div>
        )}
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

      {/* 拍照确认弹窗 */}
      {capturedPhoto && (
        <div className="polaroid-modal" onClick={cancelCapture}>
          <div className="polaroid-modal-content" onClick={e => e.stopPropagation()}>
            <button className="btn-close" onClick={cancelCapture}>✕</button>

            <div className="polaroid-preview">
              <img src={capturedPhoto} alt="照片" />
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
                  onClick={handleConfirmAndGenerate}
                  disabled={!editDream.trim()}
                >
                  确认并生成 ✨
                </button>
              </div>
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
              <div className="gallery-grouped">
                {Object.entries(
                  history.reduce((groups, item) => {
                    const name = item.name || '未命名';
                    if (!groups[name]) {
                      groups[name] = [];
                    }
                    groups[name].push(item);
                    return groups;
                  }, {} as Record<string, HistoryItem[]>)
                ).map(([name, items]) => (
                  <div key={name} className="gallery-group">
                    <div className="gallery-group-header">
                      <span className="gallery-group-name">{name}</span>
                      <span className="gallery-group-count">{items.length} 张</span>
                    </div>
                    <div className="gallery-group-grid">
                      {items.map((item) => (
                        <div
                          key={item.id}
                          className="gallery-item"
                          onClick={() => setSelectedHistoryItem(item)}
                        >
                          <img src={item.resultPhoto} alt={item.name} />
                          <div className="gallery-item-dream">
                            <span>{item.dream}</span>
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
