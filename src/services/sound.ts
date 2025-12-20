// 音效服务 - 支持自定义音频文件，无文件时使用 Web Audio API 合成音效
//
// 自定义音效使用方法：
// 将音频文件放到 public/sounds/ 目录，文件名对应音效类型：
//   - shutter.mp3    拍照快门
//   - upload.mp3     上传图片
//   - cameraOn.mp3   开启摄像头
//   - cameraOff.mp3  关闭摄像头
//   - confirm.mp3    确认生成
//   - complete.mp3   生成完成
//   - error.mp3      生成失败
//   - eject.mp3      胶片弹出
//   - developing.mp3 显影进行中（循环播放）
//   - click.mp3      统一点击音
// 支持格式：mp3, wav, ogg

// 音效类型
export type SoundType =
  | 'shutter'      // 拍照快门
  | 'upload'       // 上传图片
  | 'cameraOn'     // 开启摄像头
  | 'cameraOff'    // 关闭摄像头
  | 'confirm'      // 确认生成
  | 'complete'     // 生成完成
  | 'error'        // 生成失败
  | 'eject'        // 胶片弹出
  | 'developing'   // 显影进行中
  | 'click';       // 统一点击音

// 音效类别
export type SoundCategory =
  | 'shutter'    // 快门音效：拍照
  | 'camera'     // 相机音效：开启/关闭摄像头
  | 'operation'  // 操作音效：上传、确认生成
  | 'feedback'   // 反馈音效：生成完成、错误
  | 'animation'  // 动画音效：胶片弹出、显影
  | 'ui';        // 界面音效：所有按钮点击

// 音效类型到类别的映射
const soundToCategory: Record<SoundType, SoundCategory> = {
  shutter: 'shutter',
  cameraOn: 'camera',
  cameraOff: 'camera',
  upload: 'operation',
  confirm: 'operation',
  complete: 'feedback',
  error: 'feedback',
  eject: 'animation',
  developing: 'animation',
  click: 'ui',
};

// 类别名称（中文）
export const categoryNames: Record<SoundCategory, string> = {
  shutter: '快门音效',
  camera: '相机音效',
  operation: '操作音效',
  feedback: '反馈音效',
  animation: '动画音效',
  ui: '界面音效',
};

// 类别描述
export const categoryDescriptions: Record<SoundCategory, string> = {
  shutter: '拍照',
  camera: '开启/关闭摄像头',
  operation: '上传、确认生成',
  feedback: '生成完成、错误提示',
  animation: '胶片弹出、显影',
  ui: '按钮点击',
};

// 所有类别
export const allCategories: SoundCategory[] = ['shutter', 'camera', 'operation', 'feedback', 'animation', 'ui'];

// 音效设置接口
export interface SoundSettings {
  masterMute: boolean;  // 全局静音
  categories: Record<SoundCategory, boolean>;  // 各类别开关
}

// 默认设置（仅开启快门、相机、动画音效）
const defaultSettings: SoundSettings = {
  masterMute: false,
  categories: {
    shutter: true,
    camera: true,
    operation: false,
    feedback: false,
    animation: true,
    ui: false,
  },
};

// 存储 key
const SOUND_SETTINGS_KEY = 'dream-dress-sound-settings';

// 当前设置
let currentSettings: SoundSettings = { ...defaultSettings };

// 加载设置
function loadSettings(): SoundSettings {
  try {
    const saved = localStorage.getItem(SOUND_SETTINGS_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        masterMute: parsed.masterMute ?? false,
        categories: { ...defaultSettings.categories, ...parsed.categories },
      };
    }
  } catch (e) {
    console.warn('加载音效设置失败:', e);
  }
  return { ...defaultSettings };
}

// 保存设置
function saveSettings(settings: SoundSettings): void {
  try {
    localStorage.setItem(SOUND_SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {
    console.warn('保存音效设置失败:', e);
  }
}

// 初始化加载
currentSettings = loadSettings();

// 获取当前设置
export function getSoundSettings(): SoundSettings {
  return { ...currentSettings };
}

// 更新设置
export function updateSoundSettings(settings: Partial<SoundSettings>): void {
  if (settings.masterMute !== undefined) {
    currentSettings.masterMute = settings.masterMute;
  }
  if (settings.categories) {
    currentSettings.categories = { ...currentSettings.categories, ...settings.categories };
  }
  saveSettings(currentSettings);
}

// 切换全局静音
export function toggleMasterMute(): boolean {
  currentSettings.masterMute = !currentSettings.masterMute;
  saveSettings(currentSettings);
  return currentSettings.masterMute;
}

// 获取全局静音状态
export function isMasterMuted(): boolean {
  return currentSettings.masterMute;
}

// 切换类别开关
export function toggleCategory(category: SoundCategory): boolean {
  currentSettings.categories[category] = !currentSettings.categories[category];
  saveSettings(currentSettings);
  return currentSettings.categories[category];
}

// 设置类别开关
export function setCategoryEnabled(category: SoundCategory, enabled: boolean): void {
  currentSettings.categories[category] = enabled;
  saveSettings(currentSettings);
}

// 检查音效是否可以播放
function canPlaySound(type: SoundType): boolean {
  if (currentSettings.masterMute) return false;
  const category = soundToCategory[type];
  return currentSettings.categories[category];
}

// Audio Context
let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioContext;
}

// ============ 自定义音频文件支持 ============

// 支持的音频格式
const AUDIO_EXTENSIONS = ['mp3', 'wav', 'ogg'];

// 缓存已加载的自定义音频
const customAudioCache: Map<SoundType, HTMLAudioElement> = new Map();

// 标记哪些音效有自定义文件
const hasCustomAudio: Set<SoundType> = new Set();

// 预加载状态
let preloadComplete = false;

// 所有音效类型列表
const allSoundTypes: SoundType[] = [
  'shutter', 'upload', 'cameraOn', 'cameraOff', 'confirm',
  'complete', 'error', 'eject', 'developing', 'click'
];

// 尝试加载单个音频文件
async function tryLoadAudio(type: SoundType): Promise<HTMLAudioElement | null> {
  for (const ext of AUDIO_EXTENSIONS) {
    const url = `/sounds/${type}.${ext}`;
    try {
      const audio = new Audio();
      await new Promise<void>((resolve, reject) => {
        audio.oncanplaythrough = () => resolve();
        audio.onerror = () => reject();
        audio.src = url;
      });
      console.log(`✓ 已加载自定义音效: ${type}.${ext}`);
      return audio;
    } catch {
      // 该格式文件不存在，继续尝试下一个
    }
  }
  return null;
}

// 预加载所有自定义音频
async function preloadCustomAudio(): Promise<void> {
  if (preloadComplete) return;

  const loadPromises = allSoundTypes.map(async (type) => {
    const audio = await tryLoadAudio(type);
    if (audio) {
      customAudioCache.set(type, audio);
      hasCustomAudio.add(type);
    }
  });

  await Promise.all(loadPromises);
  preloadComplete = true;

  if (hasCustomAudio.size > 0) {
    console.log(`音效系统: 已加载 ${hasCustomAudio.size} 个自定义音效`);
  }
}

// 播放自定义音频（返回是否成功播放）
function playCustomAudio(type: SoundType, loop: boolean = false): boolean {
  if (!hasCustomAudio.has(type)) return false;

  const cachedAudio = customAudioCache.get(type);
  if (!cachedAudio) return false;

  try {
    // 克隆音频以支持重叠播放
    const audio = cachedAudio.cloneNode() as HTMLAudioElement;
    audio.loop = loop;
    audio.play().catch(() => {});

    // 如果是循环音效，保存引用以便后续停止
    if (loop && type === 'developing') {
      customDevelopingAudio = audio;
    }

    return true;
  } catch {
    return false;
  }
}

// 自定义显影音频引用（用于停止循环）
let customDevelopingAudio: HTMLAudioElement | null = null;

// 播放简单音调
function playTone(frequency: number, duration: number, type: OscillatorType = 'sine', volume: number = 0.2) {
  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') ctx.resume();

    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.frequency.value = frequency;
    oscillator.type = type;

    gainNode.gain.setValueAtTime(volume, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + duration);
  } catch (e) {
    console.warn('播放音效失败:', e);
  }
}

// 播放快门音效（模拟机械快门声）
function playShutter() {
  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') ctx.resume();

    const bufferSize = ctx.sampleRate * 0.08;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.15));
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 2000;
    filter.Q.value = 1;

    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(0.5, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);

    noise.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(ctx.destination);

    noise.start();
  } catch (e) {
    console.warn('播放快门音效失败:', e);
  }
}

// 播放完成音效（愉悦的两音符）
function playComplete() {
  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') ctx.resume();

    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.frequency.value = 523.25;
    osc1.type = 'sine';
    gain1.gain.setValueAtTime(0.25, ctx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
    osc1.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + 0.15);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.frequency.value = 659.25;
    osc2.type = 'sine';
    gain2.gain.setValueAtTime(0.25, ctx.currentTime + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
    osc2.start(ctx.currentTime + 0.12);
    osc2.stop(ctx.currentTime + 0.35);
  } catch (e) {
    console.warn('播放完成音效失败:', e);
  }
}

// 播放错误音效（低沉的警示音）
function playError() {
  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') ctx.resume();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 220;
    osc.type = 'sawtooth';
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
  } catch (e) {
    console.warn('播放错误音效失败:', e);
  }
}

// 播放胶片弹出音效（机械滑动声）
function playEject() {
  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') ctx.resume();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.frequency.setValueAtTime(800, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.3);
    osc.type = 'sine';

    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
  } catch (e) {
    console.warn('播放弹出音效失败:', e);
  }
}

// 显影音效控制
let developingOsc: OscillatorNode | null = null;
let developingGain: GainNode | null = null;

// 开始显影音效
export function startDevelopingSound() {
  if (!canPlaySound('developing')) return;

  // 优先使用自定义音频（循环播放）
  if (playCustomAudio('developing', true)) return;

  // 无自定义音频时使用合成音效
  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') ctx.resume();

    developingOsc = ctx.createOscillator();
    developingGain = ctx.createGain();

    developingOsc.connect(developingGain);
    developingGain.connect(ctx.destination);

    developingOsc.frequency.value = 60;
    developingOsc.type = 'sine';
    developingGain.gain.value = 0.05;

    developingOsc.start();
  } catch (e) {
    console.warn('播放显影音效失败:', e);
  }
}

// 停止显影音效
export function stopDevelopingSound() {
  // 停止自定义音频
  if (customDevelopingAudio) {
    customDevelopingAudio.pause();
    customDevelopingAudio.currentTime = 0;
    customDevelopingAudio = null;
  }

  // 停止合成音效
  try {
    if (developingGain) {
      developingGain.gain.exponentialRampToValueAtTime(0.001, getAudioContext().currentTime + 0.1);
    }
    setTimeout(() => {
      if (developingOsc) {
        developingOsc.stop();
        developingOsc = null;
        developingGain = null;
      }
    }, 150);
  } catch (e) {
    // 忽略
  }
}

// 主播放函数
export function playSound(type: SoundType) {
  if (!canPlaySound(type)) return;

  // 优先使用自定义音频
  if (playCustomAudio(type)) return;

  // 无自定义音频时使用合成音效
  switch (type) {
    case 'shutter':
      playShutter();
      break;
    case 'upload':
      playTone(600, 0.1, 'sine', 0.2);
      setTimeout(() => playTone(800, 0.1, 'sine', 0.2), 80);
      break;
    case 'cameraOn':
      playTone(400, 0.08, 'sine', 0.15);
      setTimeout(() => playTone(600, 0.1, 'sine', 0.2), 60);
      break;
    case 'cameraOff':
      playTone(600, 0.08, 'sine', 0.15);
      setTimeout(() => playTone(400, 0.1, 'sine', 0.2), 60);
      break;
    case 'confirm':
      playTone(500, 0.1, 'sine', 0.2);
      break;
    case 'complete':
      playComplete();
      break;
    case 'error':
      playError();
      break;
    case 'eject':
      playEject();
      break;
    case 'click':
      playTone(800, 0.03, 'square', 0.1);
      break;
    case 'developing':
      // 显影音效通过 startDevelopingSound/stopDevelopingSound 控制
      break;
  }
}

// 初始化音频
export function initAudio() {
  try {
    getAudioContext();
    // 预加载自定义音频文件
    preloadCustomAudio();
  } catch (e) {
    console.warn('初始化音频失败:', e);
  }
}

// 兼容旧 API
export function getMuted(): boolean {
  return currentSettings.masterMute;
}

export function setMuted(muted: boolean): void {
  currentSettings.masterMute = muted;
  saveSettings(currentSettings);
}
