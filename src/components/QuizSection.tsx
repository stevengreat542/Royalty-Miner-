import React, { useState } from 'react';
import { BookOpen, CheckCircle, XCircle, ArrowRight, Sparkles, Award } from 'lucide-react';
import { useWallet } from '../context/WalletContext';
import { QUIZ_QUESTIONS } from '../data/mockData';
import { formatSats } from '../utils/crypto';
import { sound } from '../utils/audio';

export const QuizSection: React.FC = () => {
  const { completedQuizIds, completeQuizQuestion } = useWallet();
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [hasSubmitted, setHasSubmitted] = useState<boolean>(false);

  const question = QUIZ_QUESTIONS[currentIndex];
  const isAnswered = completedQuizIds.includes(question.id);
  const totalCompleted = completedQuizIds.length;
  const totalAvailable = QUIZ_QUESTIONS.length;
  const totalSatsEarned = completedQuizIds.length * 50;

  const handleSelect = (idx: number) => {
    if (hasSubmitted || isAnswered) return;
    setSelectedOption(idx);
  };

  const handleSubmit = () => {
    if (selectedOption === null) return;
    setHasSubmitted(true);

    if (selectedOption === question.correctIndex) {
      sound.playWin();
      completeQuizQuestion(question.id, question.satReward);
    } else {
      sound.playTick();
    }
  };

  const handleNext = () => {
    setSelectedOption(null);
    setHasSubmitted(false);
    setCurrentIndex((prev) => (prev + 1) % QUIZ_QUESTIONS.length);
  };

  return (
    <div className="space-y-8">
      {/* Top Banner & Academy Metrics */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-800 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-amber-400">
            <BookOpen className="h-3.5 w-3.5" />
            <span>Satoshi Knowledge Academy</span>
            <span className="text-neutral-600" aria-hidden="true">·</span>
            <span className="text-neutral-400">Earn 50 Sats Per Passed Assessment</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-100 mt-1 [text-wrap:balance]">
            Bitcoin & Cryptographic Protocol Challenges
          </h1>
          <p className="text-xs text-neutral-400 mt-1 max-w-xl">
            Test and deepen your understanding of consensus rules, halving schedules, Lightning state channels, and Satoshi Nakamoto history.
          </p>
        </div>

        {/* Progress summary */}
        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 px-3.5 py-2 text-right">
            <div className="text-[10px] text-neutral-500 uppercase tracking-wider font-sans">
              Completed
            </div>
            <div className="text-base font-bold text-neutral-100 tabular-nums">
              {totalCompleted} / {totalAvailable}
            </div>
          </div>
          <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 px-3.5 py-2 text-right">
            <div className="text-[10px] text-neutral-500 uppercase tracking-wider font-sans">
              Academy Sats Earned
            </div>
            <div className="text-base font-bold text-amber-300 tabular-nums">
              +{formatSats(totalSatsEarned)}
            </div>
          </div>
        </div>
      </div>

      {/* Main Quiz Board */}
      <div className="mx-auto max-w-3xl space-y-6">
        {/* Question Selector Strip */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2">
          {QUIZ_QUESTIONS.map((q, idx) => {
            const isDone = completedQuizIds.includes(q.id);
            const isCurrent = idx === currentIndex;

            return (
              <button
                key={q.id}
                onClick={() => {
                  setCurrentIndex(idx);
                  setSelectedOption(null);
                  setHasSubmitted(false);
                }}
                className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-mono font-medium transition-colors shrink-0 ${
                  isCurrent
                    ? 'border border-amber-500 bg-amber-500/20 text-amber-300 font-bold'
                    : isDone
                    ? 'border border-neutral-800 bg-neutral-900 text-emerald-400'
                    : 'border border-neutral-800 bg-neutral-950 text-neutral-400 hover:text-neutral-200'
                }`}
              >
                {idx + 1}
              </button>
            );
          })}
        </div>

        {/* Question Card */}
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-6 sm:p-8 space-y-6">
          <div className="flex items-center justify-between text-xs text-neutral-400">
            <span>
              Category: <span className="text-neutral-200 font-medium">{question.category}</span>
            </span>
            <span className="font-mono text-amber-400">+{question.satReward} Sats</span>
          </div>

          <h2 className="text-lg sm:text-xl font-bold text-neutral-100 leading-snug">
            {question.question}
          </h2>

          {/* Options */}
          <div className="space-y-3">
            {question.options.map((option, idx) => {
              const isSelected = selectedOption === idx;
              const isCorrect = idx === question.correctIndex;

              let style = 'border-neutral-800 bg-neutral-950/60 text-neutral-300 hover:border-neutral-700 hover:bg-neutral-900/50';

              if (hasSubmitted || isAnswered) {
                if (isCorrect) {
                  style = 'border-emerald-500/50 bg-emerald-500/10 text-emerald-200';
                } else if (isSelected && !isCorrect) {
                  style = 'border-red-500/50 bg-red-500/10 text-red-200';
                } else {
                  style = 'border-neutral-800/60 bg-neutral-950/30 text-neutral-500';
                }
              } else if (isSelected) {
                style = 'border-amber-500/80 bg-amber-500/10 text-amber-200';
              }

              return (
                <button
                  key={idx}
                  onClick={() => handleSelect(idx)}
                  disabled={hasSubmitted || isAnswered}
                  className={`w-full rounded-xl border p-4 text-left text-sm font-medium transition-all flex items-center justify-between gap-3 ${style}`}
                >
                  <span>{option}</span>

                  {(hasSubmitted || isAnswered) && isCorrect && (
                    <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
                  )}
                  {(hasSubmitted || isAnswered) && isSelected && !isCorrect && (
                    <XCircle className="h-4 w-4 text-red-400 shrink-0" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Educational Explanation Box */}
          {(hasSubmitted || isAnswered) && (
            <div className="rounded-xl border border-neutral-800 bg-neutral-950/80 p-4 space-y-2 animate-fade-in text-xs leading-relaxed">
              <div className="flex items-center gap-1.5 font-semibold text-neutral-200">
                <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                <span>Protocol Explanation & Context:</span>
              </div>
              <p className="text-neutral-400">{question.explanation}</p>
            </div>
          )}

          {/* Action Row */}
          <div className="flex items-center justify-between pt-2">
            {!hasSubmitted && !isAnswered ? (
              <button
                onClick={handleSubmit}
                disabled={selectedOption === null}
                className="rounded-xl bg-amber-500 hover:bg-amber-400 disabled:bg-neutral-800 disabled:text-neutral-500 px-6 py-2.5 text-xs font-semibold text-neutral-950 transition-colors"
              >
                Submit Answer
              </button>
            ) : (
              <button
                onClick={handleNext}
                className="flex items-center gap-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 px-5 py-2.5 text-xs font-medium text-neutral-200 transition-colors"
              >
                <span>Next Question</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            )}

            {isAnswered && (
              <div className="text-xs text-emerald-400 flex items-center gap-1.5">
                <Award className="h-4 w-4" />
                <span>Sats Claimed for this Challenge</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
