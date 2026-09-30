import React, { useState } from 'react';
import { CheckSquare, Terminal, Check, Play, ShieldAlert, Award } from 'lucide-react';
import { useWallet } from '../context/WalletContext';
import { MICRO_TASKS } from '../data/mockData';
import { TaskItem } from '../types';
import { formatSats } from '../utils/crypto';
import { sound } from '../utils/audio';

export const TasksSection: React.FC = () => {
  const { completedTaskIds, completeTask } = useWallet();
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [logs, setLogs] = useState<string[]>([]);

  const activeTask = MICRO_TASKS.find((t) => t.id === activeTaskId);

  const startTaskExecution = (task: TaskItem) => {
    setActiveTaskId(task.id);
    setCurrentStep(0);
    setIsRunning(true);
    setLogs([`[INIT] Starting task verification: "${task.title}"`, `[SEC] Connecting to local cryptographic sandbox...`]);

    let step = 0;
    const interval = setInterval(() => {
      if (step < task.steps.length) {
        const stepText = task.steps[step];
        setLogs((prev) => [...prev, `[EXEC] Step ${step + 1}/${task.steps.length}: ${stepText} [OK]`]);
        step += 1;
        setCurrentStep(step);
        sound.playTick();
      } else {
        clearInterval(interval);
        setIsRunning(false);
        setLogs((prev) => [...prev, `[COMPLETE] Verification verified. Payout released: +${task.reward} Sats.`]);
        completeTask(task.id, task.reward);
      }
    }, 1200);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-800 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-amber-400">
            <CheckSquare className="h-3.5 w-3.5" />
            <span>Community Bounties & Protocol Checks</span>
            <span className="text-neutral-600" aria-hidden="true">·</span>
            <span className="text-neutral-400">Instant Lightning Sat Payouts</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-100 mt-1 [text-wrap:balance]">
            Micro-Tasks & Node Bounties
          </h1>
          <p className="text-xs text-neutral-400 mt-1 max-w-xl">
            Execute simulated network audits, channel rebalances, and protocol verifications to earn satoshis.
          </p>
        </div>

        <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 px-3.5 py-2 text-right font-mono text-xs">
          <div className="text-[10px] text-neutral-500 uppercase tracking-wider font-sans">
            Bounties Claimed
          </div>
          <div className="text-base font-bold text-amber-300 tabular-nums">
            {completedTaskIds.length} / {MICRO_TASKS.length}
          </div>
        </div>
      </div>

      {/* Task Execution Modal / Drawer if Active */}
      {activeTask && (
        <div className="rounded-2xl border border-amber-500/40 bg-neutral-950 p-6 space-y-4 shadow-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-amber-400 font-semibold">
              <Terminal className="h-4 w-4" />
              <span>Executing Sandbox: {activeTask.title}</span>
            </div>
            {!isRunning && (
              <button
                onClick={() => setActiveTaskId(null)}
                className="text-xs text-neutral-400 hover:text-neutral-200"
              >
                Close Console
              </button>
            )}
          </div>

          {/* Stepper bar */}
          <div className="grid grid-cols-3 gap-2">
            {activeTask.steps.map((st, i) => {
              const done = currentStep > i;
              const current = currentStep === i && isRunning;
              return (
                <div
                  key={i}
                  className={`rounded-lg border p-2 text-xs transition-colors ${
                    done
                      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                      : current
                      ? 'border-amber-500/50 bg-amber-500/10 text-amber-200 animate-pulse'
                      : 'border-neutral-800 bg-neutral-900/40 text-neutral-500'
                  }`}
                >
                  <div className="font-semibold">Step {i + 1}</div>
                  <div className="text-[11px] truncate">{st}</div>
                </div>
              );
            })}
          </div>

          {/* Terminal log output */}
          <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-3.5 font-mono text-xs text-neutral-300 space-y-1 h-36 overflow-y-auto">
            {logs.map((log, i) => (
              <div key={i} className="text-[11px] leading-relaxed">
                <span className="text-neutral-500">&gt; </span>
                {log}
              </div>
            ))}
          </div>

          {!isRunning && currentStep >= activeTask.steps.length && (
            <div className="flex items-center justify-between text-xs text-emerald-400 pt-1">
              <div className="flex items-center gap-1.5 font-medium">
                <Check className="h-4 w-4" />
                <span>Task Successfully Verified! +{activeTask.reward} Sats credited.</span>
              </div>
              <button
                onClick={() => setActiveTaskId(null)}
                className="rounded-lg bg-neutral-800 px-4 py-1.5 font-medium text-neutral-200 hover:bg-neutral-700"
              >
                Done
              </button>
            </div>
          )}
        </div>
      )}

      {/* Task List Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {MICRO_TASKS.map((task) => {
          const isDone = completedTaskIds.includes(task.id);
          const isCurrentActive = activeTaskId === task.id;

          return (
            <div
              key={task.id}
              className={`rounded-xl border p-5 space-y-3 transition-all ${
                isDone
                  ? 'border-neutral-800 bg-neutral-950/40 opacity-80'
                  : 'border-neutral-800 bg-neutral-900/40 hover:border-neutral-700'
              }`}
            >
              <div className="flex items-center justify-between text-xs text-neutral-400">
                <span className="text-neutral-500 uppercase tracking-wider text-[10px]">
                  Category: {task.category} · {task.duration}
                </span>
                <span className="font-mono font-bold text-amber-400 tabular-nums">
                  +{task.reward} SATS
                </span>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-neutral-100">
                  {task.title}
                </h3>
                <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
                  {task.description}
                </p>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-neutral-800/80">
                <div className="text-[11px] text-neutral-500">
                  {task.stepCount} validation checkpoints
                </div>

                {isDone ? (
                  <div className="flex items-center gap-1 text-xs text-emerald-400 font-medium">
                    <Award className="h-3.5 w-3.5" />
                    <span>Completed</span>
                  </div>
                ) : (
                  <button
                    onClick={() => startTaskExecution(task)}
                    disabled={isRunning}
                    className="flex items-center gap-1.5 rounded-lg bg-neutral-800 hover:bg-amber-500 hover:text-neutral-950 px-3.5 py-1.5 text-xs font-medium text-neutral-200 transition-colors disabled:opacity-50"
                  >
                    <Play className="h-3 w-3 fill-current" />
                    <span>{isCurrentActive && isRunning ? 'Running...' : 'Execute Task'}</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
