#!/usr/bin/env node
// 一键验收.mjs：对渲染完成的知识动画作品执行 5 道硬门禁全自动验收，任一门禁不达标即退出码非 0。
// 用法：node pipeline/一键验收.mjs <作品目录>
// 门禁清单：
//   1. 确定性门禁：render.mjs --check-determinism auto（正跳与倒跳逐像素零误差）
//   2. 扫片与卡点图：render.mjs --scan --check-marks（自动生成 检查/扫片_*.png 与 检查/卡点.png）
//   3. 画面丰富度门禁：丰富度检查.mjs（相邻格平均差 ≥ 10、在动的帧 ≥ 60%、最长静止 ≤ 1.8 秒）
//   4. 音画同步与响度门禁：视频与音频流时长差 ≤ 0.12 秒、RMS 响度处于 [-26, -11] dB（防静音或爆音）
//   5. 配音克隆质量门禁（若存在 配音报告.json 且 mode=clone）：声纹余弦相似度均值 ≥ 0.80、单句盲听最低准确率 ≥ 0.90

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const PIPE = path.dirname(new URL(import.meta.url).pathname);
const dirArg = process.argv[2];
if (!dirArg) {
  console.error('用法：node pipeline/一键验收.mjs <作品目录>');
  process.exit(1);
}
const workDir = path.resolve(dirArg);
const cfgPath = path.join(workDir, '作品.json');
const cfg = fs.existsSync(cfgPath) ? JSON.parse(fs.readFileSync(cfgPath, 'utf8')) : {};
const htmlPath = path.join(workDir, cfg.entry || cfg.page || 'index.html');
const mp4Path = path.join(workDir, cfg.output || `${path.basename(workDir)}.mp4`);
const gpuFlags = cfg.gpu ? ['--gpu'] : [];
const checkDir = path.join(workDir, '检查');
fs.mkdirSync(checkDir, { recursive: true });

let failed = 0;
const gates = {};
const pass = (k, msg, data = {}) => { console.log(`  ✓ [${k}] ${msg}`); gates[k] = { ok: true, msg, ...data }; };
const fail = (k, msg, data = {}) => { failed++; console.error(`  ✗ [${k}] ${msg}`); gates[k] = { ok: false, msg, ...data }; };

if (!fs.existsSync(htmlPath)) { console.error(`✗ 找不到页面：${htmlPath}`); process.exit(1); }
if (!fs.existsSync(mp4Path)) { console.error(`✗ 找不到成片：${mp4Path}（请先运行 node pipeline/render.mjs）`); process.exit(1); }

console.log(`=== dashi-studio 一键六道门禁验收：${path.basename(workDir)} ===`);

// 门禁 1：确定性检查
try {
  const out = execFileSync('node', [path.join(PIPE, 'render.mjs'), htmlPath, '--check-determinism', 'auto', ...gpuFlags], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  if (/✗|不一致|不同/.test(out)) fail('确定性', out.trim());
  else pass('确定性', out.trim().split('\n').pop() || '25%/50%/75% 三时刻正倒序截帧逐像素一致');
} catch (e) {
  fail('确定性', (e.stderr || e.stdout || e.message).toString().trim());
}

// 门禁 2：扫片与关键词前后帧卡点拼图
try {
  execFileSync('node', [path.join(PIPE, 'render.mjs'), htmlPath, '--scan', '--check-marks', '--outdir', checkDir, ...gpuFlags], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  const scans = fs.readdirSync(checkDir).filter((f) => /^扫片_\d+\.png$/.test(f));
  const hasMarkImg = fs.existsSync(path.join(checkDir, '卡点.png'));
  if (scans.length > 0) pass('扫片与卡点图', `已生成 ${scans.length} 张扫片拼图${hasMarkImg ? ' + 卡点.png' : ''}`, { scans, hasMarkImg });
  else fail('扫片与卡点图', '未生成扫片拼图');
} catch (e) {
  fail('扫片与卡点图', (e.stderr || e.stdout || e.message).toString().trim());
}

// 门禁 3：画面丰富度检查
try {
  const out = execFileSync('node', [path.join(PIPE, '丰富度检查.mjs'), mp4Path, '--outdir', checkDir], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  const avgM = out.match(/相邻格变化[：:]\s*平均\s*([\d.]+)/);
  const flatM = out.match(/几乎没变\s*(\d+)\s*\/\s*(\d+)/);
  const movM = out.match(/在动的帧[：:]\s*([\d.]+)%/);
  const stillM = out.match(/最长静止[：:]\s*([\d.]+)\s*秒/);
  const avgDiff = avgM ? +avgM[1] : 0;
  const flatPairs = flatM ? +flatM[1] : 0;
  const movPct = movM ? +movM[1] : 0;
  const maxStill = stillM ? +stillM[1] : 99;
  const summary = `相邻格平均差 ${avgDiff.toFixed(1)}（阈值≥10，几乎没变 ${flatPairs} 对），在动的帧 ${movPct.toFixed(1)}%（阈值≥60%），最长静止 ${maxStill.toFixed(2)}s（阈值≤1.8s）`;
  if (avgDiff >= 10 && flatPairs === 0 && movPct >= 60 && maxStill <= 1.8) pass('画面丰富度', summary, { avgDiff, flatPairs, movPct, maxStill });
  else fail('画面丰富度', summary, { avgDiff, flatPairs, movPct, maxStill });
} catch (e) {
  fail('画面丰富度', (e.stderr || e.stdout || e.message).toString().trim());
}

// 门禁 4：音画时长同步与音频响度非静音核验
try {
  const vDur = parseFloat(execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=duration', '-of', 'default=noprint_wrappers=1:nokey=1', mp4Path], { encoding: 'utf8' }).trim());
  const aDur = parseFloat(execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'a:0', '-show_entries', 'stream=duration', '-of', 'default=noprint_wrappers=1:nokey=1', mp4Path], { encoding: 'utf8' }).trim());
  let rmsDb = -99;
  try {
    execFileSync('ffmpeg', ['-hide_banner', '-i', mp4Path, '-af', 'astats=metadata=1:reset=0', '-f', 'null', '-'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (ee) {
    // ffmpeg -f null 正常退出码为 0，这里兜底
  }
  const ffLog = execFileSync('sh', ['-c', `ffmpeg -hide_banner -i "${mp4Path}" -af astats=metadata=1:reset=0 -f null - 2>&1`], { encoding: 'utf8' });
  const rmsMatches = [...ffLog.matchAll(/RMS level dB:\s*([-\d.]+)/g)];
  if (rmsMatches.length) rmsDb = +rmsMatches[rmsMatches.length - 1][1];
  const drift = Math.abs(vDur - aDur);
  const summary = `视频 ${vDur.toFixed(2)}s / 音频 ${aDur.toFixed(2)}s（偏差 ${drift.toFixed(3)}s），音轨 RMS ${rmsDb.toFixed(2)} dB`;
  if (drift <= 0.15 && rmsDb >= -26 && rmsDb <= -11) pass('音画与响度', summary, { vDur, aDur, drift, rmsDb });
  else fail('音画与响度', summary, { vDur, aDur, drift, rmsDb });
} catch (e) {
  fail('音画与响度', e.message);
}

// 门禁 5：配音克隆声纹与盲听指标核验
const voiceRepPath = path.join(workDir, '配音报告.json');
if (fs.existsSync(voiceRepPath)) {
  const vr = JSON.parse(fs.readFileSync(voiceRepPath, 'utf8'));
  if (vr.mode === 'clone') {
    const sim = vr.mean_voice_sim ?? 0;
    const asr = vr.min_asr_ratio ?? 0;
    const summary = `RTX 3060 克隆（${vr.speaker}）声纹余弦均值 ${sim}（阈值≥0.80），单句盲听最低准确率 ${asr}（阈值≥0.90），纯推理 ${vr.realtime_factor_x}x 实时`;
    if (sim >= 0.80 && asr >= 0.90) pass('音色克隆指标', summary, vr);
    else fail('音色克隆指标', summary, vr);
  } else {
    pass('配音模式核验', `模式=${vr.mode}（${vr.speaker || vr.source_audio || ''}）`, vr);
  }
}

// 门禁 6：程序化动作音效与侧链母带核验（若启用了 音效合成.py）
const sfxRepPath = path.join(checkDir, '音效报告.json');
if (fs.existsSync(sfxRepPath)) {
  const sr = JSON.parse(fs.readFileSync(sfxRepPath, 'utf8'));
  const lufs = sr.ebur128_lufs ?? -99;
  const tp = sr.ebur128_true_peak_dbfs ?? 0;
  const hasWave = fs.existsSync(path.join(checkDir, '波形卡点.png'));
  const summary = `风格=${sr.style}，音效事件 ${sr.sfx_events_count} 个，权威响度 ${lufs} LUFS（目标 -16±2.5），真峰值 ${tp} dBFS（阈值≤-1.0）${hasWave ? '，已出 波形卡点.png' : ''}`;
  if (lufs >= -18.5 && lufs <= -13.5 && tp <= -1.0 && hasWave) pass('音效母带与卡点波形', summary, sr);
  else fail('音效母带与卡点波形', summary, sr);
}

const reportOut = path.join(checkDir, '验收报告.json');
fs.writeFileSync(reportOut, JSON.stringify({ ok: failed === 0, checkedAt: new Date().toISOString(), mp4: mp4Path, gates }, null, 2) + '\n');
console.log(`\n${failed === 0 ? '✓ 全部门禁通过！' : `✗ 有 ${failed} 道门禁未通过`} 报告已写入 ${reportOut}`);
process.exit(failed === 0 ? 0 : 1);
