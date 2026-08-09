// 真实站点截图抓取（puppeteer-core + 系统 Edge）
// 用法: node scripts/capture.mjs probe|game|shots
import puppeteer from 'puppeteer-core';
import {mkdirSync} from 'node:fs';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const SITE = 'https://wordle.yuer6327.top';
const OUT = 'public/screens';
mkdirSync(OUT, {recursive: true});

const VIEW = {width: 520, height: 1000};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function launch() {
  return puppeteer.launch({
    executablePath: EDGE,
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu', '--window-size=520,1000'],
    defaultViewport: VIEW,
  });
}

// 点击符号池按钮：棋盘瓦片也是按钮，需取 DOM 中最后一个匹配（符号池在最下方）
async function clickSymbol(page, sym) {
  await page.evaluate((s) => {
    const btns = [...document.querySelectorAll('button')].filter((x) => x.textContent.trim() === s);
    const b = btns[btns.length - 1];
    if (b) b.click();
  }, sym);
  await sleep(90);
}

async function emptyCount(page) {
  return page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')];
    return btns.filter((b) => b.textContent.trim() === '' && b.className.includes('rounded')).length;
  });
}

// 循环填满所有空槽位（每次点第一个空槽 + 一个符号），返回是否填满
async function fillAllSlots(page, symbols) {
  let guard = 0;
  while (guard++ < 100) {
    const empty = await emptyCount(page);
    if (empty === 0) return true;
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find(
        (x) => x.textContent.trim() === '' && x.className.includes('rounded')
      );
      if (b) b.click();
    });
    await sleep(120);
    await clickSymbol(page, symbols[(guard - 1) % symbols.length]);
    await sleep(120);
  }
  return (await emptyCount(page)) === 0;
}

const mode = process.argv[2] || 'probe';

if (mode === 'probe') {
  const browser = await launch();
  const page = await browser.newPage();
  try {
    await page.goto(SITE + '/#/', {waitUntil: 'networkidle2', timeout: 45000});
    await sleep(2000);
    console.log((await page.evaluate(() => document.body.innerText)).slice(0, 500));
    await page.screenshot({path: OUT + '/menu-probe.png'});
  } finally {
    await browser.close();
  }
}

if (mode === 'answer') {
  const browser = await launch();
  const page = await browser.newPage();
  try {
    await page.goto(SITE + '/#/game/medium/solo', {waitUntil: 'networkidle2', timeout: 45000});
    await sleep(3000);
    const eq = await page.evaluate(() => {
      const root = document.getElementById('root');
      const startEl = root.firstChild || root;
      const key = Object.keys(startEl).find((k) => k.startsWith('__reactFiber$')) ||
        Object.keys(root).find((k) => k.startsWith('__reactContainer$'));
      let node = startEl[key] || root[key];
      const states = [];
      let guard = 0;
      while (node && guard++ < 3000) {
        if (node.memoizedState) {
          let hook = node.memoizedState;
          while (hook) {
            states.push(hook.memoizedState);
            hook = hook.next;
          }
        }
        node = node.return;
      }
      const found = states.find(
        (s) => s && typeof s === 'object' && Array.isArray(s.answer) && s.answer.length > 0 && s.tokens
      );
      if (!found) return {found: false, n: states.length};
      return {
        found: true,
        answer: found.answer,
        seed: found.seed,
        tokens: found.tokens.map((t) => (t.hidden ? '[' + t.symbol + ']' : t.symbol)),
      };
    });
    console.log(JSON.stringify(eq, null, 2));
    await page.screenshot({path: OUT + '/answer.png'});
  } finally {
    await browser.close();
  }
}

if (mode === 'shots') {
  const browser = await launch();
  const page = await browser.newPage();
  try {
    // 1) 主菜单
    await page.goto(SITE + '/#/', {waitUntil: 'networkidle2', timeout: 45000});
    await sleep(2500);
    await page.screenshot({path: OUT + '/menu.png'});
    console.log('✓ menu.png');

    // 2) 单人游戏（中等，板面更饱满）——空槽位盘面
    await page.goto(SITE + '/#/game/medium/solo', {waitUntil: 'networkidle2', timeout: 45000});
    await sleep(3000);
    const slotCount = await emptyCount(page);
    console.log('slots:', slotCount);
    await page.screenshot({path: OUT + '/game-fresh.png'});
    console.log('✓ game-fresh.png');

    // 3) 填词进行中（填入一半）
    const half = Math.max(1, Math.floor(slotCount / 2));
    for (let i = 0; i < half; i++) {
      await page.evaluate(() => {
        const b = [...document.querySelectorAll('button')].find(
          (x) => x.textContent.trim() === '' && x.className.includes('rounded')
        );
        if (b) b.click();
      });
      await sleep(110);
      await clickSymbol(page, ['3', '×', '7', '−', '5', '+', '8'][i % 7]);
    }
    await page.screenshot({path: OUT + '/game-fill.png'});
    console.log('✓ game-fill.png');

    // 4) 用真实答案构造"大部分正确"的猜词，提交后一行同时展示 绿/黄/灰
    const eqInfo = await page.evaluate(() => {
      const root = document.getElementById('root');
      const startEl = root.firstChild || root;
      const key =
        Object.keys(startEl).find((k) => k.startsWith('__reactFiber$')) ||
        Object.keys(root).find((k) => k.startsWith('__reactContainer$'));
      let node = startEl[key] || root[key];
      const states = [];
      let guard = 0;
      while (node && guard++ < 3000) {
        if (node.memoizedState) {
          let hook = node.memoizedState;
          while (hook) {
            states.push(hook.memoizedState);
            hook = hook.next;
          }
        }
        node = node.return;
      }
      const found = states.find(
        (s) => s && typeof s === 'object' && Array.isArray(s.answer) && s.answer.length > 0 && s.tokens
      );
      return found ? found.answer : null;
    });
    console.log('answer:', eqInfo ? eqInfo.join(' ') : null);

    // 展示映射：内部符号 -> 符号池按钮文本
    const DISP = {pi: 'π', sqrt: '√', log: 'lg'};
    const PICKER = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'π', '+', '−', '×', '÷', '^', '%', '√', 'sin', 'cos', 'lg', 'tan'];
    const guess = eqInfo ? [...eqInfo] : ['1', '×', '1', '=', '1'];
    if (eqInfo) {
      // 换两个位置 -> 产生黄色；换一个到不在答案中的符号 -> 产生灰色
      const n = guess.length;
      const swap = [Math.floor(n / 3), Math.floor((2 * n) / 3)];
      [guess[swap[0]], guess[swap[1]]] = [guess[swap[1]], guess[swap[0]]];
      const inAns = new Set(eqInfo);
      const graySym = PICKER.find((s) => !inAns.has(DISP[s] ? DISP[s] : s) && !inAns.has(s));
      if (graySym && n > 2) {
        const gi = (swap[0] + 2) % n;
        if (gi !== swap[0] && gi !== swap[1]) guess[gi] = graySym;
      }
    }
    const display = guess.map((s) => DISP[s] || s);
    console.log('guess:', display.join(' '));
    // 清空半填的棋盘，再按构造的猜词填满
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === '清空');
      if (b) b.click();
    });
    await sleep(300);
    const ok = await fillAllSlots(page, display);
    console.log('filled fully:', ok);
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === '提交猜测');
      if (b) b.click();
    });
    await sleep(1600);
    const after = await page.evaluate(() => document.body.innerText.slice(0, 600));
    console.log('=== AFTER SUBMIT ===');
    console.log(after);
    await page.screenshot({path: OUT + '/game-feedback.png'});
    console.log('✓ game-feedback.png');

    // 5) 好友房间（创建）
    await page.goto(SITE + '/#/room/medium?create=1', {waitUntil: 'networkidle2', timeout: 45000});
    await sleep(3500);
    await page.screenshot({path: OUT + '/room.png'});
    console.log('✓ room.png');

    // 6) 统计 & 排行榜
    await page.goto(SITE + '/#/stats', {waitUntil: 'networkidle2', timeout: 45000});
    await sleep(2500);
    await page.screenshot({path: OUT + '/stats.png'});
    console.log('✓ stats.png');
    await page.goto(SITE + '/#/leaderboard', {waitUntil: 'networkidle2', timeout: 45000});
    await sleep(2500);
    await page.screenshot({path: OUT + '/leaderboard.png'});
    console.log('✓ leaderboard.png');
  } finally {
    await browser.close();
  }
}
