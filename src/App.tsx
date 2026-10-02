import React, { useState, useCallback, useEffect } from 'react';
import {
  DEFAULT_COURSES,
  LogicCourse,
  STAGE_LENGTH,
} from './data/courses';
import {
  LogicDiveCanvas,
  TelemetryState,
  DeathReason,
  ControlInputs,
} from './components/LogicDiveCanvas';
import { CustomQuizModal } from './components/CustomQuizModal';
import { sound } from './utils/sound';
import {
  Volume2,
  VolumeX,
  Play,
  RotateCcw,
  Sliders,
  ChevronDown,
  ChevronUp,
  Pause,
  AlertTriangle,
  Lightbulb,
  ArrowRight,
} from 'lucide-react';

export function App() {
  const [courses, setCourses] = useState<LogicCourse[]>(DEFAULT_COURSES);
  const [selectedCourseId, setSelectedCourseId] = useState<string>(DEFAULT_COURSES[0].id);
  const [gameState, setGameState] = useState<'title' | 'briefing' | 'playing' | 'paused' | 'dead' | 'victory'>('title');
  const [startStageIndex, setStartStageIndex] = useState<number>(0);
  const [runId, setRunId] = useState<number>(1);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [showCustomModal, setShowCustomModal] = useState<boolean>(false);
  const [isQuestionCollapsed, setIsQuestionCollapsed] = useState<boolean>(false);
  const [showHint, setShowHint] = useState<boolean>(false);

  const [telemetry, setTelemetry] = useState<TelemetryState>({
    z: 0,
    stageIndex: 0,
    localZ: 0,
    speedKmh: 0,
    u: 0,
    currentLane: 1,
    isBraking: false,
    isBoosting: false,
    isJumping: false,
    isHittingWall: false,
    approachingSplit: false,
    inSplitLock: false,
    upcomingHazard: null,
    safeZoneRemaining: 5.0,
  });

  const [breakBanner, setBreakBanner] = useState<{
    stageIndex: number;
    choiceText: string;
  } | null>(null);

  const [deathInfo, setDeathInfo] = useState<{
    reason: DeathReason;
    message: string;
    stageIndex: number;
    chosenIndex?: number;
  } | null>(null);

  const [victoryStats, setVictoryStats] = useState<{
    clearTimeSec: number;
    maxSpeedKmh: number;
  } | null>(null);

  const [touchInputs, setTouchInputs] = useState<ControlInputs>({
    left: false,
    right: false,
    brake: false,
    boost: false,
    jump: false,
  });

  const activeCourse = courses.find((c) => c.id === selectedCourseId) || courses[0];
  const activeQuestionIndex = gameState === 'briefing' ? startStageIndex : telemetry.stageIndex;
  const currentQuestion = activeCourse.questions[activeQuestionIndex] || activeCourse.questions[0];

  // Open Question Briefing first ("最初に問題を出しておいてスタートを押したら始まる")
  const openBriefing = useCallback((stage = 0) => {
    setStartStageIndex(stage);
    setDeathInfo(null);
    setVictoryStats(null);
    setBreakBanner(null);
    setShowHint(false);
    setRunId((p) => p + 1);
    setGameState('briefing');
    sound.playQuestionPrompt();
  }, []);

  // Launch track movement from Question Briefing
  const launchStage = useCallback(() => {
    setGameState('playing');
    sound.startBgm();
  }, []);

  const handleSelectCourse = (courseId: string) => {
    setSelectedCourseId(courseId);
    setDeathInfo(null);
    setVictoryStats(null);
    setGameState('title');
    sound.stopBgm();
  };

  const handleToggleMute = () => {
    const muted = sound.toggleMute();
    setIsMuted(muted);
  };

  const handleLogicBreak = useCallback(
    (stageIndex: number, choiceIndex: number) => {
      const q = activeCourse.questions[stageIndex];
      setBreakBanner({
        stageIndex,
        choiceText: q ? q.choices[choiceIndex] : '',
      });
      setShowHint(false);

      if (stageIndex < 2) {
        // After clearing Q1 or Q2, present the next question's briefing card!
        window.setTimeout(() => {
          setBreakBanner(null);
          sound.stopBgm();
          openBriefing(stageIndex + 1);
        }, 2000);
      } else {
        window.setTimeout(() => {
          setBreakBanner(null);
        }, 2000);
      }
    },
    [activeCourse, openBriefing]
  );

  const handleDeath = useCallback(
    (reason: DeathReason, message: string, stageIndex: number, chosenIndex?: number) => {
      sound.stopBgm();
      setDeathInfo({ reason, message, stageIndex, chosenIndex });
      setGameState('dead');
    },
    []
  );

  const handleVictory = useCallback((clearTimeSec: number, maxSpeedKmh: number) => {
    sound.stopBgm();
    setVictoryStats({ clearTimeSec, maxSpeedKmh });
    setGameState('victory');
  }, []);

  // Keyboard shortcut handlers
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (gameState === 'briefing') {
        if (e.code === 'Space' || e.code === 'Enter') {
          e.preventDefault();
          launchStage();
        }
      } else if (gameState === 'dead') {
        if (e.code === 'KeyR' || e.code === 'Space' || e.code === 'Enter') {
          e.preventDefault();
          openBriefing(deathInfo?.stageIndex ?? 0);
        }
      } else if (gameState === 'playing') {
        if (e.code === 'KeyQ') {
          setIsQuestionCollapsed((prev) => !prev);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [gameState, deathInfo, launchStage, openBriefing]);

  const setTouch = (key: keyof ControlInputs, val: boolean) => {
    setTouchInputs((prev) => ({ ...prev, [key]: val }));
  };

  const totalLength = STAGE_LENGTH * 3;
  const progressPct = Math.min(100, Math.max(0, (telemetry.z / totalLength) * 100));

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#050711] select-none flex flex-col font-sans">
      {/* 3-Zone Top Bar */}
      <header className="relative z-30 flex items-center justify-between px-5 py-2.5 bg-slate-950/90 backdrop-blur-md border-b border-white/10 shrink-0">
        {/* Zone 1: Wordmark */}
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            sound.stopBgm();
            setGameState('title');
          }}
          className="text-base md:text-lg font-bold font-display tracking-wider text-cyan-400 whitespace-nowrap"
        >
          LOGICAL DASH
        </a>

        {/* Zone 2: Navigation / Courses */}
        <nav className="hidden md:flex items-center gap-5 text-xs md:text-sm font-medium text-slate-300">
          {courses.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => handleSelectCourse(c.id)}
              className={`transition-colors whitespace-nowrap pb-0.5 ${
                selectedCourseId === c.id
                  ? 'text-white border-b-2 border-cyan-400 font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {c.title}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setShowCustomModal(true)}
            className="text-slate-400 hover:text-cyan-300 transition-colors whitespace-nowrap flex items-center gap-1"
          >
            <Sliders className="w-3.5 h-3.5" />
            問題作成
          </button>
        </nav>

        {/* Zone 3: Actions */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleToggleMute}
            className="p-1.5 text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
            aria-label={isMuted ? 'サウンドをオン' : 'サウンドをミュート'}
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-cyan-400" />}
          </button>

          {gameState === 'playing' ? (
            <button
              type="button"
              onClick={() => setGameState('paused')}
              className="px-3.5 py-1.5 text-xs font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-lg transition-colors whitespace-nowrap flex items-center gap-1"
            >
              <Pause className="w-3.5 h-3.5" />
              一時停止
            </button>
          ) : gameState === 'briefing' ? (
            <button
              type="button"
              onClick={launchStage}
              className="px-4 py-1.5 text-xs font-bold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-lg transition-colors whitespace-nowrap flex items-center gap-1 shadow"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              スタート！
            </button>
          ) : (
            <button
              type="button"
              onClick={() => openBriefing(0)}
              className="px-4 py-1.5 text-xs font-bold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-lg transition-colors whitespace-nowrap flex items-center gap-1"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              問題を確認して開始
            </button>
          )}
        </div>
      </header>

      {/* Main 3D Viewport */}
      <main className="relative flex-1 w-full h-full overflow-hidden">
        <LogicDiveCanvas
          course={activeCourse}
          gameState={gameState}
          startStageIndex={startStageIndex}
          runId={runId}
          touchInputs={touchInputs}
          onTelemetry={setTelemetry}
          onLogicBreak={handleLogicBreak}
          onDeath={handleDeath}
          onVictory={handleVictory}
        />

        {/* ==================== 1. QUESTION BRIEFING SCREEN (最初に問題を出しておいてスタートを押したら始まる) ==================== */}
        {gameState === 'briefing' && (
          <div className="absolute inset-0 z-20 flex items-center justify-center p-4 bg-gradient-to-t from-black/80 via-black/50 to-black/30 backdrop-blur-[3px]">
            <div className="w-full max-w-xl bg-slate-950/95 border border-cyan-400/60 rounded-xl p-5 md:p-6 shadow-2xl space-y-4 text-left">
              {/* Question Header */}
              <div className="flex items-center justify-between border-b border-white/10 pb-2.5 text-xs">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-cyan-400 text-slate-950 font-bold text-[11px] rounded font-mono-tabular">
                    第{startStageIndex + 1}問 / 全3問
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono-tabular">
                    {activeCourse.title}
                  </span>
                </div>
                <span className="text-[11px] text-amber-400 font-semibold">
                  難易度：低め（安心設計）
                </span>
              </div>

              {/* Main Question Text (控えめな文字サイズ) */}
              <div className="space-y-1">
                <p className="text-[10px] text-cyan-300 font-semibold tracking-wider font-mono-tabular">
                  QUESTION PROMPT // 推理問題
                </p>
                <h2 className="text-xs md:text-sm font-semibold text-white leading-relaxed">
                  {currentQuestion.prompt}
                </h2>
              </div>

              {/* 3 Choices Paths Guide */}
              <div className="space-y-1.5">
                <p className="text-[11px] text-slate-400 font-medium">
                  コース上の3つの分岐ルート（正解の道へダイブせよ）：
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <div className="p-2.5 rounded-lg bg-cyan-950/40 border border-cyan-500/40 space-y-0.5">
                    <span className="text-[10px] font-bold text-cyan-300 block">
                      ← [Aキー] 左ルート
                    </span>
                    <p className="text-xs text-slate-200 font-normal">
                      {currentQuestion.choices[0]}
                    </p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-amber-950/40 border border-amber-500/40 space-y-0.5">
                    <span className="text-[10px] font-bold text-amber-300 block">
                      ▲ [中央] 直進ルート
                    </span>
                    <p className="text-xs text-slate-200 font-normal">
                      {currentQuestion.choices[1]}
                    </p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-rose-950/40 border border-rose-500/40 space-y-0.5">
                    <span className="text-[10px] font-bold text-rose-300 block">
                      [Dキー] 右ルート →
                    </span>
                    <p className="text-xs text-slate-200 font-normal">
                      {currentQuestion.choices[2]}
                    </p>
                  </div>
                </div>
              </div>

              {/* Deduction Hint */}
              <div className="p-2.5 rounded-lg bg-slate-900 border border-white/10 flex items-start gap-2 text-[11px] text-slate-300">
                <Lightbulb className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-amber-300 mr-1">ヒント:</span>
                  <span>{currentQuestion.hint}</span>
                </div>
              </div>

              {/* Big Start Button */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 pt-1">
                <p className="text-[11px] text-slate-400">
                  スタート後も最初の5秒間は安全走行区間です
                </p>
                <button
                  type="button"
                  onClick={launchStage}
                  className="w-full sm:w-auto px-5 py-2.5 bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold text-xs rounded-lg shadow transition-all flex items-center justify-center gap-1.5 whitespace-nowrap"
                >
                  <span>第{startStageIndex + 1}問をスタート！</span>
                  <ArrowRight className="w-4 h-4" />
                  <kbd className="text-[10px] font-mono-tabular bg-slate-950/20 px-1.5 py-0.5 rounded text-slate-900 font-bold ml-0.5">
                    SPACE / Enter
                  </kbd>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ==================== 2. PLAYING HUD OVERLAY ==================== */}
        {gameState === 'playing' && (
          <div className="absolute inset-0 z-10 pointer-events-none flex flex-col justify-between p-3 md:p-4">
            {/* Top area: Top-Left Minimal Question Widget + Center Alert Chip */}
            <div className="w-full flex items-start justify-between">
              {/* TOP-LEFT MINIMAL QUESTION WIDGET (Leaves the entire central track 100% visible!) */}
              <div className="pointer-events-auto max-w-[260px] md:max-w-[300px] bg-slate-950/75 backdrop-blur-sm border border-white/10 rounded-lg p-2 shadow space-y-1">
                <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono-tabular">
                  <span className="font-bold text-cyan-400">第{telemetry.stageIndex + 1}問 / 全3問</span>
                  <span>進捗 {Math.round(progressPct)}%</span>
                </div>
                <p className="text-[11px] font-normal text-slate-200 line-clamp-2 leading-tight">
                  {currentQuestion.prompt}
                </p>
                {currentQuestion.hint && (
                  <button
                    type="button"
                    onClick={() => setShowHint((p) => !p)}
                    className="text-[9px] text-amber-400 hover:underline flex items-center gap-0.5"
                  >
                    <Lightbulb className="w-2.5 h-2.5" />
                    {showHint ? currentQuestion.hint : 'ヒントを表示'}
                  </button>
                )}
              </div>

              {/* CENTER ALERT CHIP (Thin single line, only visible when needed) */}
              <div className="pointer-events-auto flex-1 flex justify-center px-4">
                {telemetry.isHittingWall ? (
                  <div className="px-3 py-1 bg-rose-950/90 border border-rose-500 rounded-full text-[11px] font-bold text-rose-200 shadow flex items-center gap-1.5 animate-pulse">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                    <span>壁に接触中！ [A/D]で迂回、または[SPACE]でジャンプ</span>
                  </div>
                ) : telemetry.safeZoneRemaining > 0 ? (
                  <div className="px-3 py-0.5 bg-emerald-950/85 border border-emerald-400/40 rounded-full text-[10px] font-medium text-emerald-300 shadow flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                    <span>安全走行区間（ギミック出現まで {telemetry.safeZoneRemaining.toFixed(1)}s）</span>
                  </div>
                ) : (telemetry.upcomingHazard || telemetry.approachingSplit) ? (
                  <div className="px-3 py-0.5 bg-slate-950/90 border border-amber-400/40 rounded-full text-[10px] font-medium text-amber-300 shadow">
                    {telemetry.approachingSplit
                      ? '⚡ 分岐ゲート接近中！ 正解の道へダイブせよ [A / D]'
                      : `⚠️ ${telemetry.upcomingHazard}`}
                  </div>
                ) : null}
              </div>

              <div className="w-10" />
            </div>

            {/* Center Logic Break cut-in */}
            {breakBanner && (
              <div className="my-auto flex justify-center pointer-events-none">
                <div className="bg-emerald-950/95 border-2 border-emerald-400 px-7 py-3 rounded-xl shadow-2xl text-center">
                  <p className="text-[10px] font-mono-tabular text-emerald-300 tracking-wider font-bold">
                    QUESTION 0{breakBanner.stageIndex + 1} LOGIC BREAK!!
                  </p>
                  <p className="text-lg md:text-xl font-extrabold font-display text-white mt-0.5">
                    正解！「{breakBanner.choiceText}」
                  </p>
                  <p className="text-[11px] text-emerald-200 mt-0.5">
                    {breakBanner.stageIndex < 2 ? '次の問題の確認画面へ移行します…' : '最終ゴールへ突入中！'}
                  </p>
                </div>
              </div>
            )}

            {/* Bottom HUD: Choices + Speedometer + Controls (All placed cleanly at bottom!) */}
            <div className="w-full max-w-4xl mx-auto space-y-2 pointer-events-auto">
              {/* Row 1: 3 Route Choice Indicators */}
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { idx: 0 as const, label: '← [A] 左ルート', border: 'border-cyan-500/60 bg-cyan-950/70', text: 'text-cyan-300' },
                    { idx: 1 as const, label: '▲ [中央] 直進ルート', border: 'border-amber-500/60 bg-amber-950/70', text: 'text-amber-300' },
                    { idx: 2 as const, label: '[D] 右ルート →', border: 'border-rose-500/60 bg-rose-950/70', text: 'text-rose-300' },
                  ]
                ).map((c) => {
                  const isCurrent = telemetry.currentLane === c.idx;
                  return (
                    <div
                      key={c.idx}
                      className={`px-2.5 py-1 rounded-lg border text-xs transition-colors backdrop-blur-sm ${
                        isCurrent
                          ? `${c.border} ring-1 ring-white/30 font-semibold shadow`
                          : 'border-white/10 bg-slate-950/50 opacity-70'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[9px] mb-0.5">
                        <span className={c.text}>{c.label}</span>
                        {isCurrent && <span className="text-white text-[8px]">走行中</span>}
                      </div>
                      <p className="text-[11px] text-slate-100 truncate">
                        {currentQuestion.choices[c.idx]}
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* Row 2: Speedometer & Controls */}
              <div className="flex flex-col md:flex-row items-stretch md:items-end justify-between gap-2.5">
              <div className="bg-slate-950/80 backdrop-blur-md border border-white/10 rounded-xl px-4 py-2 flex items-center gap-4">
                <div>
                  <span className="block text-[10px] text-slate-400">SPEED</span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold font-mono-tabular text-cyan-400">
                      {telemetry.speedKmh}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono-tabular">km/h</span>
                  </div>
                </div>
                <div className="h-7 w-px bg-white/10" />
                <div className="text-xs">
                  <div className="text-slate-200 font-semibold">
                    {telemetry.isHittingWall
                      ? '🛑 壁で停止中（避けるかジャンプ）'
                      : telemetry.isBraking
                      ? '🛑 ブレーキ停止中 [S]'
                      : telemetry.isBoosting
                      ? '⚡ 加速中 [Shift]'
                      : telemetry.isJumping
                      ? '🚀 ジャンプ中 [Space]'
                      : '🏂 クルーズ走行中'}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    A(左) · D(右) · S(止まる) · Shift(加速) · Space(跳ぶ)
                  </div>
                </div>
              </div>

              {/* On-Screen / Touch Pad Buttons */}
              <div className="bg-slate-950/80 backdrop-blur-md border border-white/10 rounded-xl p-2 flex items-center justify-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onMouseDown={() => setTouch('left', true)}
                  onMouseUp={() => setTouch('left', false)}
                  onMouseLeave={() => setTouch('left', false)}
                  onTouchStart={() => setTouch('left', true)}
                  onTouchEnd={() => setTouch('left', false)}
                  className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 active:bg-cyan-500 active:text-slate-950 border border-white/15 rounded-lg text-xs font-semibold text-white whitespace-nowrap"
                >
                  <span className="text-cyan-400 font-mono-tabular mr-1">[A]</span>
                  左
                </button>

                <button
                  type="button"
                  onMouseDown={() => setTouch('brake', true)}
                  onMouseUp={() => setTouch('brake', false)}
                  onMouseLeave={() => setTouch('brake', false)}
                  onTouchStart={() => setTouch('brake', true)}
                  onTouchEnd={() => setTouch('brake', false)}
                  className={`px-3 py-1.5 border rounded-lg text-xs font-semibold whitespace-nowrap ${
                    telemetry.isBraking
                      ? 'bg-rose-500 text-white border-rose-400'
                      : 'bg-slate-900 hover:bg-slate-800 border-white/15 text-white'
                  }`}
                >
                  <span className="text-rose-400 font-mono-tabular mr-1">[S]</span>
                  止まる
                </button>

                <button
                  type="button"
                  onMouseDown={() => setTouch('right', true)}
                  onMouseUp={() => setTouch('right', false)}
                  onMouseLeave={() => setTouch('right', false)}
                  onTouchStart={() => setTouch('right', true)}
                  onTouchEnd={() => setTouch('right', false)}
                  className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 active:bg-cyan-500 active:text-slate-950 border border-white/15 rounded-lg text-xs font-semibold text-white whitespace-nowrap"
                >
                  <span className="text-cyan-400 font-mono-tabular mr-1">[D]</span>
                  右
                </button>

                <button
                  type="button"
                  onMouseDown={() => setTouch('boost', true)}
                  onMouseUp={() => setTouch('boost', false)}
                  onMouseLeave={() => setTouch('boost', false)}
                  onTouchStart={() => setTouch('boost', true)}
                  onTouchEnd={() => setTouch('boost', false)}
                  className={`px-3 py-1.5 border rounded-lg text-xs font-semibold whitespace-nowrap ${
                    telemetry.isBoosting
                      ? 'bg-amber-400 text-slate-950 border-amber-300'
                      : 'bg-slate-900 hover:bg-slate-800 border-white/15 text-white'
                  }`}
                >
                  <span className="text-amber-400 font-mono-tabular mr-1">[Shift]</span>
                  加速
                </button>

                <button
                  type="button"
                  onMouseDown={() => setTouch('jump', true)}
                  onMouseUp={() => setTouch('jump', false)}
                  onMouseLeave={() => setTouch('jump', false)}
                  onTouchStart={() => setTouch('jump', true)}
                  onTouchEnd={() => setTouch('jump', false)}
                  className={`px-3.5 py-1.5 border rounded-lg text-xs font-bold whitespace-nowrap ${
                    telemetry.isJumping
                      ? 'bg-cyan-400 text-slate-950 border-cyan-300'
                      : 'bg-cyan-500/20 border-cyan-400/50 text-cyan-200'
                  }`}
                >
                  <span className="text-cyan-300 font-mono-tabular mr-1">[Space]</span>
                  ジャンプ
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

        {/* ==================== 3. TITLE / SELECT SCREEN ==================== */}
        {gameState === 'title' && (
          <div className="absolute inset-0 z-20 flex items-center justify-center p-5 bg-gradient-to-t from-black/85 via-black/55 to-black/30">
            <div className="w-full max-w-3xl bg-slate-950/90 backdrop-blur-md border border-white/15 rounded-2xl p-6 md:p-8 shadow-2xl space-y-6">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-5 border-b border-white/10">
                <div>
                  <p className="text-xs font-semibold text-cyan-400 tracking-wider font-mono-tabular">
                    LOGICAL DASH // 3-QUESTION ACTION QUIZ
                  </p>
                  <h1 className="text-3xl md:text-4xl font-extrabold font-display text-white mt-1">
                    Logical Dash
                  </h1>
                  <p className="text-xs md:text-sm text-slate-300 mt-1">
                    最初に問題をじっくり確認し、スタートボタンでダイブ開始！低難易度で安心して楽しめます。
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => openBriefing(0)}
                  className="px-6 py-3.5 bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold text-sm rounded-xl shadow-lg transition-colors whitespace-nowrap flex items-center justify-center gap-2 shrink-0"
                >
                  <Play className="w-4 h-4 fill-current" />
                  第1問を確認してスタート
                </button>
              </div>

              {/* Course Selection */}
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <h2 className="text-xs font-bold text-slate-200">
                    出題コース（全3問 · 難易度低め）
                  </h2>
                  <button
                    type="button"
                    onClick={() => setShowCustomModal(true)}
                    className="text-xs font-semibold text-cyan-400 hover:text-cyan-300 transition-colors flex items-center gap-1"
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    問題作成・編集
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {courses.map((c) => {
                    const isSelected = c.id === activeCourse.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setSelectedCourseId(c.id)}
                        className={`text-left p-3.5 rounded-xl border transition-colors ${
                          isSelected
                            ? 'bg-slate-900 border-cyan-400 shadow-md'
                            : 'bg-slate-900/40 border-white/10 hover:border-white/20'
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs text-slate-400 mb-1 font-mono-tabular">
                          <span className="text-cyan-400 font-bold">{c.code}</span>
                          <span>難易度：低め</span>
                        </div>
                        <h3 className="text-sm font-bold text-white">{c.title}</h3>
                        <p className="text-xs text-slate-400 mt-1 line-clamp-2">{c.subtitle}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Controls & Rules */}
              <div className="pt-4 border-t border-white/10 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div>
                  <h3 className="font-bold text-slate-200 mb-2">操作方法</h3>
                  <div className="grid grid-cols-2 gap-1.5">
                    <div className="p-2 rounded bg-slate-900 border border-white/10 flex justify-between">
                      <span className="text-slate-300">左へ移動</span>
                      <kbd className="px-1.5 py-0.5 bg-slate-800 text-cyan-300 rounded font-bold">A キー</kbd>
                    </div>
                    <div className="p-2 rounded bg-slate-900 border border-white/10 flex justify-between">
                      <span className="text-slate-300">右へ移動</span>
                      <kbd className="px-1.5 py-0.5 bg-slate-800 text-cyan-300 rounded font-bold">D キー</kbd>
                    </div>
                    <div className="p-2 rounded bg-slate-900 border border-white/10 flex justify-between">
                      <span className="text-slate-300">止まる</span>
                      <kbd className="px-1.5 py-0.5 bg-slate-800 text-rose-300 rounded font-bold">S キー</kbd>
                    </div>
                    <div className="p-2 rounded bg-slate-900 border border-white/10 flex justify-between">
                      <span className="text-slate-300">加速</span>
                      <kbd className="px-1.5 py-0.5 bg-slate-800 text-amber-300 rounded font-bold">Shift キー</kbd>
                    </div>
                    <div className="col-span-2 p-2 rounded bg-slate-900 border border-white/10 flex justify-between">
                      <span className="text-slate-300">ジャンプ（落とし穴・壁を跳ぶ）</span>
                      <kbd className="px-2 py-0.5 bg-slate-800 text-cyan-300 rounded font-bold">Space キー</kbd>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-bold text-slate-200 mb-2">安心ルール設計</h3>
                  <ul className="space-y-1.5 text-slate-300 leading-relaxed">
                    <li>
                      <span className="text-cyan-400 font-bold mr-1">・事前に問題確認：</span>
                      各問題の滑走前に、問題と選択肢をじっくり読んでからスタートボタンで滑走開始できます。
                    </li>
                    <li>
                      <span className="text-emerald-400 font-bold mr-1">・低難易度・安全区間：</span>
                      スタート後5秒間はギミックが出現せず、障害物も少なめで回避スペースが広く設計されています。
                    </li>
                    <li>
                      <span className="text-amber-400 font-bold mr-1">・障害物壁：</span>
                      壁に当たっても死亡しません（進めなくなるだけなので、避けるか跳び越えられます）。
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ==================== 4. PAUSED OVERLAY ==================== */}
        {gameState === 'paused' && (
          <div className="absolute inset-0 z-20 flex items-center justify-center p-5 bg-black/75 backdrop-blur-sm">
            <div className="w-full max-w-sm bg-slate-900 border border-white/15 rounded-xl p-5 text-center space-y-4 shadow-2xl">
              <h2 className="text-xl font-bold font-display text-white">PAUSED // 一時停止中</h2>
              <p className="text-xs text-slate-400">現在：第{telemetry.stageIndex + 1}問</p>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => setGameState('playing')}
                  className="w-full py-2 bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold text-xs rounded-lg transition-colors"
                >
                  再開する
                </button>
                <button
                  type="button"
                  onClick={() => openBriefing(telemetry.stageIndex)}
                  className="w-full py-2 bg-white/10 hover:bg-white/15 text-white font-semibold text-xs rounded-lg transition-colors"
                >
                  この問題（第{telemetry.stageIndex + 1}問）を確認してやり直す
                </button>
                <button
                  type="button"
                  onClick={() => {
                    sound.stopBgm();
                    setGameState('title');
                  }}
                  className="w-full py-1.5 text-slate-400 hover:text-white text-xs transition-colors"
                >
                  タイトルへ戻る
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ==================== 5. DEATH OVERLAY ==================== */}
        {gameState === 'dead' && deathInfo && (
          <div className="absolute inset-0 z-20 flex items-center justify-center p-5 bg-gradient-to-t from-rose-950/90 via-black/80 to-black/60 backdrop-blur-sm">
            <div className="w-full max-w-md bg-slate-950 border-2 border-rose-500/80 rounded-2xl p-6 shadow-2xl text-center space-y-4">
              <div>
                <p className="text-xs font-mono-tabular font-bold text-rose-400 tracking-wider">
                  {deathInfo.reason === 'wrong_answer'
                    ? 'WRONG PATH COLLAPSE // 不正解ルート落下'
                    : 'PITFALL FALLOUT // 落とし穴へ落下'}
                </p>
                <h2 className="text-2xl md:text-3xl font-extrabold font-display text-white mt-1">
                  DEAD END // 死亡
                </h2>
              </div>

              <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/30 text-left space-y-1 text-xs">
                <p className="font-bold text-rose-200 text-xs">{deathInfo.message}</p>
                <p className="text-[11px] text-slate-300">
                  第{deathInfo.stageIndex + 1}問：{activeCourse.questions[deathInfo.stageIndex].prompt}
                </p>
                <p className="text-[10px] text-amber-300">
                  ヒント：{activeCourse.questions[deathInfo.stageIndex].hint}
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => openBriefing(deathInfo.stageIndex)}
                  className="w-full sm:w-auto px-4 py-2.5 bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold text-xs rounded-xl transition-colors whitespace-nowrap flex items-center justify-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  第{deathInfo.stageIndex + 1}問を問題確認して再挑戦
                </button>
                <button
                  type="button"
                  onClick={() => openBriefing(0)}
                  className="w-full sm:w-auto px-3.5 py-2.5 bg-white/10 hover:bg-white/15 text-white font-semibold text-xs rounded-xl transition-colors whitespace-nowrap"
                >
                  第1問からやり直す
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ==================== 6. VICTORY OVERLAY ==================== */}
        {gameState === 'victory' && victoryStats && (
          <div className="absolute inset-0 z-20 flex items-center justify-center p-5 bg-gradient-to-t from-slate-950/95 via-slate-950/80 to-black/60 backdrop-blur-md overflow-y-auto">
            <div className="w-full max-w-2xl bg-slate-900 border-2 border-cyan-400 rounded-2xl p-6 shadow-2xl space-y-5 my-auto">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div>
                  <p className="text-xs font-mono-tabular font-bold text-cyan-400">
                    ALL 3 QUESTIONS CLEARED // 全3問突破！
                  </p>
                  <h2 className="text-2xl md:text-3xl font-extrabold font-display text-white mt-0.5">
                    LOGIC COMPLETE!!
                  </h2>
                </div>
                <div className="text-right font-mono-tabular text-xs">
                  <span className="text-slate-400">タイム: </span>
                  <span className="text-cyan-300 font-bold text-base">{victoryStats.clearTimeSec.toFixed(1)}s</span>
                </div>
              </div>

              <div className="space-y-2 text-xs">
                <h3 className="font-bold text-slate-200">全3問の解説</h3>
                {activeCourse.questions.map((q, idx) => (
                  <div key={q.id} className="p-3 bg-slate-950 rounded-xl border border-white/10 space-y-1">
                    <div className="flex justify-between font-bold text-cyan-400">
                      <span>第{idx + 1}問 正解：{q.choices[q.correctIndex]}</span>
                      <span className="text-slate-400 text-[11px]">
                        {q.correctIndex === 0 ? '左ルート [A]' : q.correctIndex === 1 ? '中央 [▲]' : '右ルート [D]'}
                      </span>
                    </div>
                    <p className="text-slate-300">{q.explanation}</p>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => openBriefing(0)}
                  className="px-4 py-2 bg-white/10 hover:bg-white/15 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  もう一度プレイ
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const idx = courses.findIndex((c) => c.id === activeCourse.id);
                    const next = courses[(idx + 1) % courses.length];
                    setSelectedCourseId(next.id);
                    setTimeout(() => openBriefing(0), 50);
                  }}
                  className="px-5 py-2 bg-cyan-400 hover:bg-cyan-300 text-slate-950 text-xs font-bold rounded-lg"
                >
                  次のコースへ挑戦
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Custom Quiz Modal */}
      {showCustomModal && (
        <CustomQuizModal
          initialCourse={activeCourse}
          onSave={(c) => {
            setCourses((prev) => [...prev.filter((x) => x.id !== 'course-custom'), c]);
            setSelectedCourseId(c.id);
            setShowCustomModal(false);
            setTimeout(() => openBriefing(0), 50);
          }}
          onClose={() => setShowCustomModal(false)}
        />
      )}
    </div>
  );
}

export default App;
