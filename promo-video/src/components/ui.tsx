import React from 'react';
import {AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {C} from '../theme';
import {sans} from '../fonts';

// 把当前帧归一化到 30fps 参考系：所有场景动画关键帧按 30fps 写，
// 60fps 下由本钩子换算，动画时长（真实秒数）保持不变、且逐帧更平滑。
export function useNormFrame(): number {
  const {fps} = useVideoConfig();
  const frame = useCurrentFrame();
  return frame / (fps / 30);
}

// 通用出现动画：帧区间内淡入 + 轻微上浮（frame 传 30fps 参考帧）
export function appear(frame: number, start: number, duration = 12, y = 24) {
  const opacity = interpolate(frame, [start, start + duration], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  const translate = interpolate(frame, [start, start + duration], [y, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  return {opacity, translate};
}

// 场景统一画布：暗色背景 + 顶部细网格光晕 + 底部版权角标
export const SceneFrame: React.FC<{children?: React.ReactNode}> = ({children}) => {
  return (
    <AbsoluteFill style={{backgroundColor: C.bg, overflow: 'hidden'}}>
      {/* 顶部微弱网格光晕，呼应“等式”主题 */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(60% 50% at 50% 0%, rgba(74,222,128,0.08), transparent 70%)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
          maskImage: 'radial-gradient(80% 60% at 50% 40%, black, transparent)',
          WebkitMaskImage: 'radial-gradient(80% 60% at 50% 40%, black, transparent)',
        }}
      />
      {/* 底部版权角标 */}
      <div
        style={{
          position: 'absolute',
          bottom: 28,
          left: 44,
          fontFamily: sans,
          fontSize: 18,
          color: C.text3,
          letterSpacing: 1,
        }}
      >
        MathWordle · 数学版 Wordle
      </div>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        {children}
      </div>
    </AbsoluteFill>
  );
};
