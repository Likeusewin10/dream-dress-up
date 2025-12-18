import { useState, useEffect, useCallback, useRef } from 'react';
import { generateImage } from './services/image-api';
import { settingsManager } from './services/settings';
import { generateCustomPrompt } from './constants/dreams';
import './App.css';

// 历史记录类型
interface HistoryItem {
  id: string;
  name: string;
  dream: string;
  originalPhoto: string;
  resultPhoto: string;
  timestamp: number;
}

// 应用状态
type AppState = 'camera' | 'confirm' | 'generating' | 'result';

// 本地存储 key
const HISTORY_KEY = 'dream-dress-history';

function App() {
  // 状态
  const [appState, setAppState] = useState<AppState>('camera');
  const [photo, setPhoto] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [dream, setDream] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [selectedItem, setSelectedItem] = useState<HistoryItem | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [tempApiUrl, setTempApiUrl] = useState('https://api.tu-zi.com/v1');
  const [tempApiKey, setTempApiKey] = useState('');

  // 摄像头相关
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 加载历史记录
  useEffect(() => {
    try {
      const saved = localStorage.getItem(HISTORY_KEY);
      if (saved) {
        setHistory(JSON.parse(saved));
      }
    } catch (e) {
      console.error('加载历史记录失败', e);
    }
  }, []);

  // 启动摄像头
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (error) {
      console.error('无法访问摄像头:', error);
      setError('无法访问摄像头，请检查权限或使用上传功能');
    }
  }, []);

  // 停止摄像头
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  }, []);

  // 初始化摄像头
  useEffect(() => {
    if (appState === 'camera') {
      startCamera();
    }
    return () => {
      if (appState !== 'camera') {
        stopCamera();
      }
    };
  }, [appState, startCamera, stopCamera]);

  // 拍照
  const takePhoto = useCallback(() => {
    if (!videoRef.current) return;

    const canvas = document.createElement('canvas');
    const video = videoRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    // 镜像翻转
    ctx?.translate(canvas.width, 0);
    ctx?.scale(-1, 1);
    ctx?.drawImage(video, 0, 0);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    setPhoto(dataUrl);
    setAppState('confirm');
    stopCamera();
  }, [stopCamera]);

  // 上传照片
  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      // 压缩图片
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxSize = 1280;
        let { width, height } = img;

        if (width > maxSize || height > maxSize) {
          const ratio = Math.min(maxSize / width, maxSize / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d')?.drawImage(img, 0, 0, width, height);

        setPhoto(canvas.toDataURL('image/jpeg', 0.9));
        setAppState('confirm');
        stopCamera();
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  }, [stopCamera]);

  // 重新拍照
  const retake = useCallback(() => {
    setPhoto(null);
    setResult(null);
    setName('');
    setDream('');
    setError(null);
    setAppState('camera');
  }, []);

  // 保存历史记录
  const saveHistory = useCallback((items: HistoryItem[]) => {
    setHistory(items);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(items));
  }, []);

  // 生成图片
  const handleGenerate = async () => {
    if (!photo || !dream.trim()) {
      setError('请输入你的梦想');
      return;
    }

    if (!settingsManager.hasApiKey()) {
      setShowSettings(true);
      return;
    }

    setAppState('generating');
    setError(null);

    try {
      const promptText = generateCustomPrompt(dream.trim());
      const response = await generateImage(promptText, { image: photo });

      if (response.data?.[0]?.url) {
        const imageUrl = response.data[0].url;
        setResult(imageUrl);
        setAppState('result');

        // 保存到历史记录
        const newItem: HistoryItem = {
          id: Date.now().toString(),
          name: name.trim() || '未命名',
          dream: dream.trim(),
          originalPhoto: photo,
          resultPhoto: imageUrl,
          timestamp: Date.now(),
        };
        saveHistory([newItem, ...history].slice(0, 50));
      } else {
        throw new Error('生成失败，请重试');
      }
    } catch (e: any) {
      setError(e.message || '生成失败，请重试');
      setAppState('confirm');
    }
  };

  // 删除历史记录
  const deleteHistoryItem = (id: string) => {
    saveHistory(history.filter(item => item.id !== id));
    if (selectedItem?.id === id) {
      setSelectedItem(null);
    }
  };

  return (
    <div className="app">
      {/* 历史记录按钮 */}
      <button className="history-btn" onClick={() => setShowHistory(true)}>
        📚 历史记录 {history.length > 0 && <span className="badge">{history.length}</span>}
      </button>

      {/* 主区域 */}
      <main className="main-area">
        {/* 摄像头模式 */}
        {appState === 'camera' && (
          <div className="camera-container">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="camera-video"
            />
            <div className="camera-controls">
              <button className="btn-capture" onClick={takePhoto}>
                📸
              </button>
            </div>
            <button className="btn-upload-alt" onClick={() => fileInputRef.current?.click()}>
              📁 上传照片
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              style={{ display: 'none' }}
            />
            {error && <div className="error-toast">{error}</div>}
          </div>
        )}

        {/* 确认模式 */}
        {appState === 'confirm' && photo && (
          <div className="confirm-container">
            <img src={photo} alt="拍摄的照片" className="preview-photo" />
            <div className="confirm-form">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="输入姓名（可选）"
                className="input-name"
              />
              <textarea
                value={dream}
                onChange={(e) => setDream(e.target.value)}
                placeholder="输入你的梦想..."
                className="input-dream"
                rows={3}
              />
              {error && <div className="error-msg">{error}</div>}
              <div className="confirm-buttons">
                <button className="btn-secondary" onClick={retake}>
                  重拍
                </button>
                <button
                  className="btn-primary"
                  onClick={handleGenerate}
                  disabled={!dream.trim()}
                >
                  开始变装 ✨
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 生成中 */}
        {appState === 'generating' && (
          <div className="generating-container">
            <div className="generating-animation">
              <div className="spinner"></div>
              <div className="magic-stars">✨</div>
            </div>
            <p className="generating-text">正在实现你的梦想...</p>
            <p className="generating-hint">请稍等，AI正在为你变装</p>
          </div>
        )}

        {/* 结果模式 */}
        {appState === 'result' && result && (
          <div className="result-container">
            <img src={result} alt="变装结果" className="result-photo" />
            <div className="result-info">
              <span className="result-name">{name || '未命名'}</span>
              <span className="result-dream">"{dream}"</span>
            </div>
            <div className="result-buttons">
              <a href={result} download={`${name || '梦想变装'}.png`} className="btn-download">
                📥 保存
              </a>
              <button className="btn-primary" onClick={retake}>
                再拍一张 📸
              </button>
            </div>
          </div>
        )}
      </main>

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
                    onClick={() => setSelectedItem(item)}
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

      {/* API 设置弹窗 */}
      {showSettings && (
        <div className="settings-overlay" onClick={() => setShowSettings(false)}>
          <div className="settings-container" onClick={(e) => e.stopPropagation()}>
            <div className="settings-header">
              <h2>API 配置</h2>
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
              <button
                className="btn-primary"
                onClick={() => {
                  if (tempApiKey.trim()) {
                    settingsManager.updateConfig({
                      baseUrl: tempApiUrl.trim() || 'https://api.tu-zi.com/v1',
                      apiKey: tempApiKey.trim(),
                    });
                    setShowSettings(false);
                    // 保存后自动开始生成
                    handleGenerate();
                  }
                }}
                disabled={!tempApiKey.trim()}
              >
                保存并继续
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 图片详情弹窗 */}
      {selectedItem && (
        <div className="detail-overlay" onClick={() => setSelectedItem(null)}>
          <div className="detail-container" onClick={(e) => e.stopPropagation()}>
            <button className="btn-close" onClick={() => setSelectedItem(null)}>✕</button>
            <div className="detail-images">
              <div className="detail-image-box">
                <span className="detail-label">原始照片</span>
                <img src={selectedItem.originalPhoto} alt="原始" />
              </div>
              <div className="detail-image-box">
                <span className="detail-label">变装后</span>
                <img src={selectedItem.resultPhoto} alt="变装后" />
              </div>
            </div>
            <div className="detail-info">
              <p className="detail-name">{selectedItem.name}</p>
              <p className="detail-dream">"{selectedItem.dream}"</p>
              <p className="detail-time">{new Date(selectedItem.timestamp).toLocaleString()}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
