import {loadFont as loadSpaceGrotesk} from '@remotion/google-fonts/SpaceGrotesk';
import {loadFont as loadJetBrainsMono} from '@remotion/google-fonts/JetBrainsMono';

// 标题/正文：Space Grotesk（几何现代风）
export const {fontFamily: sans} = loadSpaceGrotesk('normal', {
  weights: ['400', '500', '600', '700'],
});

// 等式/符号：JetBrains Mono（等宽，贴合游戏的 ui-monospace）
export const {fontFamily: mono} = loadJetBrainsMono('normal', {
  weights: ['400', '600', '700'],
});
