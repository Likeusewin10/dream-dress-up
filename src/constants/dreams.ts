/**
 * 默认提示词模板
 */
export const DEFAULT_PROMPT_TEMPLATE = `根据这张照片生成一张新图片。

这个人的梦想是：{dream}

要求：
1. 必须保持真实照片风格，不要卡通化、不要二次元、不要动漫风格
2. 保持照片中人物的面部特征完全一致，包括五官、肤色、表情
3. 根据梦想，给人物穿上合适的服装或造型
4. 背景要符合梦想的场景，使用真实场景而非绘画风格
5. 整体氛围：快乐、自信、充满希望
6. 输出高质量真实感照片`;

/**
 * 生成自定义梦想的提示词
 * @param customDream 用户输入的梦想
 * @param template 可选的自定义模板，使用 {dream} 作为占位符
 */
export function generateCustomPrompt(customDream: string, template?: string): string {
  const promptTemplate = template || DEFAULT_PROMPT_TEMPLATE;
  return promptTemplate.replace('{dream}', customDream);
}
