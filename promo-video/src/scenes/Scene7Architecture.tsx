import React from 'react';
import {interpolate, useCurrentFrame} from 'remotion';
import {SceneFrame} from '../components/ui';
import {Kicker, Headline, appear} from '../components/blocks';
import {C} from '../theme';
import {sans, mono} from '../fonts';

// 架构示意：浏览器(上) → Cloudflare Worker / VPS WebSocket(下)
export const Scene7Architecture: React.FC = () => {
  const frame = useCurrentFrame();

  // 连线虚线流动（帧驱动，方向朝目标盒子）
  const dashOffset = -frame * 2.4;

  const boxIn = (start: number) => appear(frame, start, 14, 26);

  const browser = boxIn(40);
  const cf = boxIn(70);
  const vps = boxIn(80);
  const caption = appear(frame, 150, 14, 20);

  // 画布坐标
  const W = 1640;
  const H = 620;
  const bx = W / 2; // 浏览器中心
  const by = 180;
  const cfw = 520;
  // 两个下盒并排居中，间隙 60，保证不重叠
  const cfl = (W - cfw * 2 - 60) / 2; // CF 盒左边缘
  const cft = 430; // CF 盒顶
  const cfcx = cfl + cfw / 2;
  const vpl = cfl + cfw + 60; // VPS 盒左边缘
  const vpcx = vpl + cfw / 2;

  return (
    <SceneFrame>
      <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 26}}>
        <Kicker start={0}>架构</Kicker>
        <Headline start={8}>三层架构 · 云原生</Headline>

        <div style={{position: 'relative', width: W, height: H}}>
          {/* 连线 */}
          <svg width={W} height={H} style={{position: 'absolute', inset: 0}}>
            {/* 浏览器 → CF */}
            <line
              x1={bx}
              y1={by + 80}
              x2={cfcx}
              y2={cft}
              stroke={C.green}
              strokeWidth={3}
              strokeDasharray="4 9"
              strokeDashoffset={dashOffset}
              opacity={0.7}
            />
            {/* 浏览器 → VPS */}
            <line
              x1={bx}
              y1={by + 80}
              x2={vpcx}
              y2={cft}
              stroke={C.yellow}
              strokeWidth={3}
              strokeDasharray="4 9"
              strokeDashoffset={dashOffset}
              opacity={0.7}
            />
          </svg>

          {/* 浏览器 */}
          <div
            style={{
              position: 'absolute',
              left: bx - 240,
              top: by - 80,
              width: 480,
              padding: '26px 0',
              borderRadius: 20,
              backgroundColor: C.panel,
              border: `2px solid ${C.borderLight}`,
              textAlign: 'center',
              opacity: browser.opacity,
              translate: browser.translate,
              boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
            }}
          >
            <div style={{fontSize: 46}}>🖥️</div>
            <div style={{fontFamily: sans, fontSize: 32, fontWeight: 700, color: C.text}}>浏览器</div>
            <div style={{fontFamily: mono, fontSize: 20, color: C.text2, marginTop: 6}}>React + Vite SPA</div>
          </div>

          {/* Cloudflare Worker */}
          <div
            style={{
              position: 'absolute',
              left: cfl,
              top: cft + 10,
              width: cfw,
              padding: '26px 22px',
              borderRadius: 20,
              backgroundColor: C.panel,
              border: `2px solid ${C.borderLight}`,
              textAlign: 'center',
              opacity: cf.opacity,
              translate: cf.translate,
              boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
            }}
          >
            <div style={{fontSize: 40}}>☁️</div>
            <div style={{fontFamily: sans, fontSize: 30, fontWeight: 700, color: C.text}}>Cloudflare Worker</div>
            <div style={{fontFamily: sans, fontSize: 20, color: C.text2, marginTop: 8}}>API · 认证 JWT · 排行榜</div>
            <div
              style={{
                marginTop: 14,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 10,
                padding: '6px 16px',
                borderRadius: 999,
                backgroundColor: C.green + '1a',
                border: `1px solid ${C.green}55`,
                fontFamily: mono,
                fontSize: 18,
                color: C.green,
              }}
            >
              ⛁ D1 SQLite
            </div>
          </div>

          {/* VPS WebSocket */}
          <div
            style={{
              position: 'absolute',
              left: vpl,
              top: cft + 10,
              width: cfw,
              padding: '26px 22px',
              borderRadius: 20,
              backgroundColor: C.panel,
              border: `2px solid ${C.borderLight}`,
              textAlign: 'center',
              opacity: vps.opacity,
              translate: vps.translate,
              boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
            }}
          >
            <div style={{fontSize: 40}}>⚡</div>
            <div style={{fontFamily: sans, fontSize: 30, fontWeight: 700, color: C.text}}>VPS WebSocket</div>
            <div style={{fontFamily: sans, fontSize: 20, color: C.text2, marginTop: 8}}>匹配 · 房间状态机</div>
            <div
              style={{
                marginTop: 14,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 10,
                padding: '6px 16px',
                borderRadius: 999,
                backgroundColor: C.yellow + '1a',
                border: `1px solid ${C.yellow}55`,
                fontFamily: mono,
                fontSize: 18,
                color: C.yellow,
              }}
            >
              服务端权威校验
            </div>
          </div>

          {/* 标签 */}
          <div
            style={{
              position: 'absolute',
              left: cfcx - 150,
              top: cft - 54,
              width: 300,
              textAlign: 'center',
              fontFamily: mono,
              fontSize: 20,
              color: C.text3,
            }}
          >
            HTTPS /api/*
          </div>
          <div
            style={{
              position: 'absolute',
              left: vpcx - 150,
              top: cft - 54,
              width: 300,
              textAlign: 'center',
              fontFamily: mono,
              fontSize: 20,
              color: C.text3,
            }}
          >
            wss:// · ticket
          </div>
        </div>

        <div style={{opacity: caption.opacity, translate: caption.translate}}>
          <div style={{fontFamily: sans, fontSize: 32, fontWeight: 500, color: C.text2, textAlign: 'center'}}>
            确定性种子 RNG · 双端逻辑一致 · seed 绝不下发客户端
          </div>
        </div>
      </div>
    </SceneFrame>
  );
};
