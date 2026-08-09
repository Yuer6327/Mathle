import React from 'react';
import {SceneFrame, useNormFrame} from '../components/ui';
import {Kicker, Headline, Phone, appear} from '../components/blocks';
import {C} from '../theme';
import {sans} from '../fonts';

const LEGEND = [
  {color: C.green, label: '位置正确', sub: '这个符号就在对应位置'},
  {color: C.yellow, label: '包含，位置不对', sub: '等式里有，但不在这里'},
  {color: C.gray, label: '不在此等式', sub: '等式里没有这个符号'},
];

export const Scene3Feedback: React.FC = () => {
  const frame = useNormFrame();
  const capIn = appear(frame, 104, 14, 20);

  return (
    <SceneFrame>
      <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 40}}>
        <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18}}>
          <Kicker start={0}>反馈</Kicker>
          <Headline start={8}>Wordle 式配色反馈</Headline>
        </div>

        <div style={{display: 'flex', alignItems: 'center', gap: 110}}>
          {/* 真实反馈截图（猜词后逐格配色） */}
          <Phone src="screens/game-feedback.png" width={360} delay={28} />

          {/* 图例讲解 */}
          <div style={{display: 'flex', flexDirection: 'column', gap: 26, width: 640}}>
            {LEGEND.map((l, i) => {
              const a = appear(frame, 34 + i * 16, 12, 22);
              return (
                <div
                  key={l.label}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 22,
                    opacity: a.opacity,
                    translate: a.translate,
                  }}
                >
                  <div
                    style={{
                      width: 74,
                      height: 74,
                      borderRadius: 16,
                      backgroundColor: l.color,
                      boxShadow: `0 8px 28px ${l.color}55`,
                      flexShrink: 0,
                    }}
                  />
                  <div style={{display: 'flex', flexDirection: 'column', gap: 3}}>
                    <div style={{fontFamily: sans, fontSize: 40, fontWeight: 700, color: C.text}}>
                      {l.label}
                    </div>
                    <div style={{fontFamily: sans, fontSize: 26, fontWeight: 500, color: C.text2}}>
                      {l.sub}
                    </div>
                  </div>
                </div>
              );
            })}
            <div style={{opacity: capIn.opacity, translate: capIn.translate, marginTop: 6}}>
              <div style={{fontFamily: sans, fontSize: 28, fontWeight: 500, color: C.text3}}>
                每一次猜测，逐格立即配色 · 真实游戏截图
              </div>
            </div>
          </div>
        </div>
      </div>
    </SceneFrame>
  );
};
