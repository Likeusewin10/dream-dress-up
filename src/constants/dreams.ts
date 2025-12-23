/**
 * 提示词模板接口
 */
export interface PromptTemplate {
  id: string;
  name: string;
  template: string;
  isBuiltIn?: boolean; // 是否为内置模板（不可删除）
}

/**
 * 自动模式模板接口（无需用户输入梦想）
 */
export interface AutoTemplate {
  id: string;
  name: string;
  icon: string;
  template: string;
  isBuiltIn?: boolean; // 是否为内置模板（不可删除）
}

/**
 * 内置的提示词模板列表
 */
export const BUILT_IN_TEMPLATES: PromptTemplate[] = [
  {
    id: 'realistic',
    name: '真实风格',
    isBuiltIn: true,
    template: `根据这张照片生成一张新图片。

这个人的梦想是：{dream}

要求：
1. 必须保持真实照片风格，不要卡通化、不要二次元、不要动漫风格
2. 保持照片中人物的面部特征完全一致，包括五官、肤色、表情
3. 根据梦想，给人物穿上合适的服装或造型
4. 背景要符合梦想的场景，使用真实场景而非绘画风格
5. 整体氛围：快乐、自信、充满希望
6. 输出高质量真实感照片`,
  },
  {
    id: 'cute-doodle',
    name: '可爱涂鸦',
    isBuiltIn: true,
    template: `根据这张照片生成一张新图片。

这个人的梦想是：{dream}

要求：
1. 必须保持真实照片风格，不要卡通化、不要二次元、不要动漫风格
2. 保持照片中人物的面部特征完全一致，包括五官、肤色、表情
3. 根据梦想，给人物穿上合适的服装或造型
4. 背景要符合梦想的场景，使用真实场景而非绘画风格
5. 整体氛围：快乐、自信、充满希望
6. 在图片上涂鸦，表达你对这个人的赞美，记得一定要很可爱萌萌哒
7. 输出高质量真实感照片`,
  },
  {
    id: 'cartoon',
    name: '卡通风格',
    isBuiltIn: true,
    template: `根据这张照片生成一张新图片。

这个人的梦想是：{dream}

要求：
1. 使用可爱的卡通风格
2. 保持人物的主要特征可辨认
3. 根据梦想，给人物穿上合适的服装或造型
4. 背景要符合梦想的场景，使用卡通风格
5. 整体氛围：可爱、活泼、充满童趣
6. 可以添加一些可爱的装饰元素`,
  },
];

// 兼容旧代码
export const PROMPT_TEMPLATES = BUILT_IN_TEMPLATES;

/**
 * 内置的自动模式模板列表（无需用户输入梦想）
 */
export const BUILT_IN_AUTO_TEMPLATES: AutoTemplate[] = [
  {
    id: 'auto-princess',
    name: '童话公主',
    icon: '👸',
    isBuiltIn: true,
    template: `根据这张照片生成一张新图片。

将照片中的人物变成迪士尼风格的童话公主/王子。

要求：
1. 保持人物的面部特征可辨认
2. 穿上华丽的公主/王子礼服，戴上皇冠或头饰
3. 背景是梦幻的童话城堡或花园
4. 整体风格：迪士尼动画风格，梦幻、优雅、充满童话色彩
5. 可以添加魔法光芒、星星等童话元素
6. 输出高质量精美图片`,
  },
  {
    id: 'auto-superhero',
    name: '超级英雄',
    icon: '🦸',
    isBuiltIn: true,
    template: `根据这张照片生成一张新图片。

将照片中的人物变成漫威/DC风格的超级英雄。

要求：
1. 保持人物的面部特征可辨认
2. 穿上炫酷的超级英雄战衣，可以有披风、面具等元素
3. 背景是城市天际线或科幻场景
4. 整体风格：美式漫画风格，酷炫、强大、充满力量感
5. 可以添加能量光效、飞行姿态等超能力元素
6. 输出高质量精美图片`,
  },
  {
    id: 'auto-wizard',
    name: '魔法师',
    icon: '🧙',
    isBuiltIn: true,
    template: `根据这张照片生成一张新图片。

将照片中的人物变成哈利波特风格的魔法师。

要求：
1. 保持人物的面部特征可辨认
2. 穿上魔法长袍，戴上巫师帽，手持魔杖
3. 背景是霍格沃茨风格的魔法城堡或神秘森林
4. 整体风格：奇幻魔法风格，神秘、智慧、充满魔力
5. 可以添加魔法光芒、飞舞的咒语、魔法生物等元素
6. 输出高质量精美图片`,
  },
  {
    id: 'auto-knight',
    name: '侠客',
    icon: '⚔️',
    isBuiltIn: true,
    template: `根据这张照片生成一张新图片。

将照片中的人物变成中国古风侠客。

要求：
1. 保持人物的面部特征可辨认
2. 穿上飘逸的古装侠客服饰，可以有斗篷、发带、佩剑等元素
3. 背景是中国山水画风格的江湖场景，如竹林、古寺、悬崖、瀑布
4. 整体风格：中国水墨武侠风格，飘逸、洒脱、仙气十足
5. 可以添加剑气、落叶、云雾等武侠元素
6. 输出高质量精美图片`,
  },
];

/**
 * 自动模板存储key
 */
export const AUTO_TEMPLATES_STORAGE_KEY = 'dream-dress-auto-templates';

/**
 * 默认提示词模板（使用真实风格）
 */
export const DEFAULT_PROMPT_TEMPLATE = BUILT_IN_TEMPLATES[0].template;

/**
 * 模板存储key
 */
export const TEMPLATES_STORAGE_KEY = 'dream-dress-templates';

/**
 * 生成自定义梦想的提示词
 * @param customDream 用户输入的梦想
 * @param template 可选的自定义模板，使用 {dream} 作为占位符
 */
export function generateCustomPrompt(customDream: string, template?: string): string {
  const promptTemplate = template || DEFAULT_PROMPT_TEMPLATE;
  return promptTemplate.replace('{dream}', customDream);
}
