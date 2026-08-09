import React from 'react';
import {SceneFrame} from '../components/ui';
import {Kicker, Headline, Bullet, GuessBoard} from '../components/blocks';
import {C} from '../theme';

export const Scene2HowToPlay: React.FC = () => {
  return (
    <SceneFrame>
      <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 44}}>
        <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18}}>
          <Kicker start={0}>玩法</Kicker>
          <Headline start={8}>猜一条隐藏的等式</Headline>
        </div>

        <div style={{display: 'flex', alignItems: 'center', gap: 100}}>
          {/* 讲解文字 */}
          <div style={{display: 'flex', flexDirection: 'column', gap: 34, width: 620}}>
            <Bullet icon="🎲" title="隐藏等式" desc="下划线代表数字（或 π 或 e）；灰框代表函数名或运算符" accent={C.green} start={34} />
            <Bullet icon="⌨️" title="符号池填空" desc="从下方符号池选数字 / 运算 / 函数，填入每个槽位" accent={C.blue} start={50} />
            <Bullet icon="⚡" title="难度升级" desc="难度越高，式子越长、符号池越丰富" accent={C.yellow} start={66} />
          </div>

          {/* 猜词动画：空槽出现 → 逐个 token 填入并带反馈色（模拟瞎猜，部分对部分错） */}
          <GuessBoard start={30} size={102} />
        </div>
      </div>
    </SceneFrame>
  );
};
