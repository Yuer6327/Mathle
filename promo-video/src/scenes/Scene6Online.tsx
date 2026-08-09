import React from 'react';
import {interpolate, useCurrentFrame} from 'remotion';
import {SceneFrame} from '../components/ui';
import {Kicker, Headline, appear} from '../components/blocks';
import {C} from '../theme';
import {sans, mono} from '../fonts';

const FEATURES = [
  {icon: '⚔️', title: '1v1 对抗', sub: '各自答案同时开猜\n先破解者胜', accent: C.yellow},
  {icon: '🤝', title: '合作模式', sub: '共享等式轮流猜测\n一起通关', accent: C.green},
  {icon: '🏠', title: '好友房间', sub: '6 位房号加入\nN 人合作', accent: C.blue},
];

export const Scene6Online: React.FC = () => {
  const frame = useCurrentFrame();
  const barIn = appear(frame, 150, 14, 24);
  const dotPulse = interpolate(frame % 50, [0, 25, 50], [0.35, 1, 0.35]);

  return (
    <SceneFrame>
      <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 52}}>
        <Kicker start={0}>联机对战</Kicker>
        <Headline start={10}>实时匹配 · 服务端权威</Headline>

        <div style={{display: 'flex', gap: 30}}>
          {FEATURES.map((f, i) => {
            const a = appear(frame, 42 + i * 15, 14, 34);
            const s = interpolate(frame, [42 + i * 15, 42 + i * 15 + 24], [0.92, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            });
            return (
              <div
                key={f.title}
                style={{
                  width: 400,
                  padding: '38px 34px',
                  borderRadius: 26,
                  backgroundColor: C.panel,
                  border: `1px solid ${C.border}`,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 18,
                  opacity: a.opacity,
                  translate: a.translate,
                  scale: String(s),
                  boxShadow: '0 24px 60px rgba(0,0,0,0.45)',
                }}
              >
                <div
                  style={{
                    width: 96,
                    height: 96,
                    borderRadius: 26,
                    backgroundColor: `${f.accent}22`,
                    border: `2px solid ${f.accent}55`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 52,
                  }}
                >
                  {f.icon}
                </div>
                <div style={{fontFamily: sans, fontSize: 42, fontWeight: 700, color: C.text}}>
                  {f.title}
                </div>
                <div
                  style={{
                    fontFamily: sans,
                    fontSize: 26,
                    fontWeight: 500,
                    color: C.text2,
                    textAlign: 'center',
                    lineHeight: 1.45,
                    whiteSpace: 'pre-line',
                  }}
                >
                  {f.sub}
                </div>
              </div>
            );
          })}
        </div>

        {/* 实时状态模拟条 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 24,
            padding: '18px 34px',
            borderRadius: 999,
            backgroundColor: C.panel,
            border: `1px solid ${C.borderLight}`,
            opacity: barIn.opacity,
            translate: barIn.translate,
          }}
        >
          <div style={{display: 'flex', alignItems: 'center', gap: 12}}>
            <div
              style={{
                width: 14,
                height: 14,
                borderRadius: 999,
                backgroundColor: C.green,
                boxShadow: `0 0 18px ${C.green}`,
                opacity: dotPulse,
              }}
            />
            <span style={{fontFamily: sans, fontSize: 28, fontWeight: 600, color: C.text}}>在线</span>
          </div>
          <div style={{width: 2, height: 30, backgroundColor: C.border}} />
          <span style={{fontFamily: sans, fontSize: 26, fontWeight: 500, color: C.text2}}>匹配中…</span>
          <div style={{width: 2, height: 30, backgroundColor: C.border}} />
          <span style={{fontFamily: mono, fontSize: 26, fontWeight: 600, color: C.yellow, letterSpacing: 3}}>
            房号 AB12CD
          </span>
        </div>
      </div>
    </SceneFrame>
  );
};
