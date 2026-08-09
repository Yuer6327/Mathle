import React from 'react';
import {SceneFrame, useNormFrame} from '../components/ui';
import {Kicker, Headline, Chip, Phone, appear} from '../components/blocks';
import {C} from '../theme';
import {sans} from '../fonts';

const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
const LEVELS = [
  {label: '入门', color: C.diff.beginner, slots: '5–8', added: ['√']},
  {label: '简单', color: C.diff.easy, slots: '7–11', added: ['π', '÷', 'sin', 'cos', 'lg']},
  {label: '中等', color: C.diff.medium, slots: '10–21', added: ['tan']},
  {label: '困难', color: C.diff.hard, slots: '20–31', added: ['e', 'ln']},
  {label: '极难', color: C.diff.expert, slots: '30–45', added: ['abs']},
];

export const Scene4Difficulty: React.FC = () => {
  const frame = useNormFrame();

  return (
    <SceneFrame>
      <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 36}}>
        <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18}}>
          <Kicker start={0}>难度</Kicker>
          <Headline start={8}>五档难度 · 符号池逐档递增</Headline>
        </div>

        <div style={{display: 'flex', alignItems: 'center', gap: 100}}>
          {/* 真实菜单截图：难度选择器 */}
          <Phone src="screens/menu.png" width={350} delay={28} />

          {/* 难度递增表 */}
          <div style={{display: 'flex', flexDirection: 'column', gap: 16, width: 700}}>
            {LEVELS.map((lv, r) => {
              const a = appear(frame, 34 + r * 15, 12, 22);
              return (
                <div
                  key={lv.label}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 20,
                    backgroundColor: C.panel,
                    border: `1px solid ${C.border}`,
                    borderRadius: 16,
                    padding: '10px 20px',
                    opacity: a.opacity,
                    translate: a.translate,
                  }}
                >
                  <div style={{minWidth: 118, display: 'flex', flexDirection: 'column'}}>
                    <span style={{fontFamily: sans, fontSize: 30, fontWeight: 700, color: lv.color}}>
                      {lv.label}
                    </span>
                    <span style={{fontFamily: sans, fontSize: 18, color: C.text3}}>
                      {lv.slots} 槽
                    </span>
                  </div>
                  <div style={{width: 2, height: 40, backgroundColor: C.border}} />
                  <div style={{display: 'flex', flexWrap: 'wrap', gap: 6}}>
                    {DIGITS.slice(0, 6).map((d) => (
                      <Chip key={d} color={C.text3} size={17}>{d}</Chip>
                    ))}
                    {lv.added.map((s) => (
                      <Chip key={s} color={lv.color} size={17}>{s}</Chip>
                    ))}
                    <span style={{fontFamily: sans, fontSize: 16, color: C.text3, alignSelf: 'center'}}>…</span>
                  </div>
                </div>
              );
            })}
            <div style={{opacity: appear(frame, 118, 12, 18).opacity, translate: appear(frame, 118, 12, 18).translate}}>
              <div style={{fontFamily: sans, fontSize: 28, fontWeight: 500, color: C.text3}}>
                真实验难度选择器 · 每档只新增符号，式子成倍变长
              </div>
            </div>
          </div>
        </div>
      </div>
    </SceneFrame>
  );
};
