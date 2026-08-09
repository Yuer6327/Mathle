import React from 'react';
import {SceneFrame, useNormFrame} from '../components/ui';
import {Kicker, Headline, Chip, appear} from '../components/blocks';
import {C} from '../theme';
import {sans} from '../fonts';

const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

const LEVELS: {
  label: string;
  color: string;
  slots: string;
  added: string[];
  pool: string[];
}[] = [
  {
    label: '入门',
    color: C.diff.beginner,
    slots: '5–8',
    added: DIGITS.concat(['+', '−', '×', '^', '%', '√']),
    pool: DIGITS.concat(['+', '−', '×', '^', '%', '√']),
  },
  {
    label: '简单',
    color: C.diff.easy,
    slots: '7–11',
    added: ['π', '÷', 'sin', 'cos', 'lg'],
    pool: DIGITS.concat(['π', '+', '−', '×', '÷', '^', '%', '√', 'sin', 'cos', 'lg']),
  },
  {
    label: '中等',
    color: C.diff.medium,
    slots: '10–21',
    added: ['tan'],
    pool: DIGITS.concat(['π', '+', '−', '×', '÷', '^', '%', '√', 'sin', 'cos', 'lg', 'tan']),
  },
  {
    label: '困难',
    color: C.diff.hard,
    slots: '20–31',
    added: ['e', 'ln'],
    pool: DIGITS.concat(['π', 'e', '+', '−', '×', '÷', '^', '%', '√', 'sin', 'cos', 'lg', 'tan', 'ln']),
  },
  {
    label: '极难',
    color: C.diff.expert,
    slots: '30–45',
    added: ['abs'],
    pool: DIGITS.concat(['π', 'e', '+', '−', '×', '÷', '^', '%', '√', 'sin', 'cos', 'lg', 'tan', 'ln', 'abs']),
  },
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

        <div style={{display: 'flex', flexDirection: 'column', gap: 22}}>
          {LEVELS.map((lv, r) => {
            const a = appear(frame, 36 + r * 16, 14, 24);
            return (
              <div
                key={lv.label}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 28,
                  backgroundColor: C.panel,
                  border: `1px solid ${C.border}`,
                  borderRadius: 18,
                  padding: '16px 26px',
                  opacity: a.opacity,
                  translate: a.translate,
                }}
              >
                {/* 难度标签 */}
                <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 150}}>
                  <span style={{fontFamily: sans, fontSize: 34, fontWeight: 700, color: lv.color, letterSpacing: 2}}>
                    {lv.label}
                  </span>
                  <span style={{fontFamily: sans, fontSize: 22, color: C.text3}}>
                    {lv.slots} 槽
                  </span>
                </div>

                {/* 分隔线 */}
                <div style={{width: 2, height: 52, backgroundColor: C.border}} />

                {/* 符号池（新增符号高亮为本档色） */}
                <div style={{display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 7, maxWidth: 1380}}>
                  {lv.pool.map((s) => {
                    const isNew = lv.added.includes(s);
                    return (
                      <Chip key={s} color={isNew ? lv.color : C.text3} size={20}>
                        {s}
                      </Chip>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </SceneFrame>
  );
};
