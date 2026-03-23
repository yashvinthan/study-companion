'use client';

import { useState } from 'react';
import { CalculatorIcon, Delete } from 'lucide-react';

export default function ScientificCalculator() {
  const [expression, setExpression] = useState('');
  const [result, setResult] = useState('');

  const appendToExpression = (value: string) => {
    setExpression((prev) => prev + value);
  };

  const calculate = () => {
    if (!expression) {
      setResult('0');
      return;
    }

    try {
      // Basic implementation replacing math functions with JS Math equivalents
      let evalExpr = expression
        .replace(/sin/g, 'Math.sin')
        .replace(/cos/g, 'Math.cos')
        .replace(/tan/g, 'Math.tan')
        .replace(/log/g, 'Math.log10')
        .replace(/ln/g, 'Math.log')
        .replace(/sqrt/g, 'Math.sqrt')
        .replace(/\^/g, '**')
        .replace(/pi/g, 'Math.PI')
        .replace(/e/g, 'Math.E');

      // Use Function constructor instead of eval for slight safety
      // eslint-disable-next-line no-new-func
      const calcResult = new Function(`return ${evalExpr}`)();
      setResult(Number.isFinite(calcResult) ? calcResult.toString() : 'Error');
    } catch {
      setResult('Error');
    }
  };

  const clear = () => {
    setExpression('');
    setResult('');
  };

  const backspace = () => {
    setExpression((prev) => prev.slice(0, -1));
  };

  const buttons = [
    { label: 'sin', action: () => appendToExpression('sin(') },
    { label: 'cos', action: () => appendToExpression('cos(') },
    { label: 'tan', action: () => appendToExpression('tan(') },
    { label: 'C', action: clear, className: 'text-rose-400 bg-rose-500/10 border-rose-500/20' },
    { label: '⌫', action: backspace, className: 'text-rose-400 bg-rose-500/10 border-rose-500/20' },

    { label: 'log', action: () => appendToExpression('log(') },
    { label: 'ln', action: () => appendToExpression('ln(') },
    { label: '(', action: () => appendToExpression('(') },
    { label: ')', action: () => appendToExpression(')') },
    { label: '÷', action: () => appendToExpression('/') },

    { label: 'sqrt', action: () => appendToExpression('sqrt(') },
    { label: '7', action: () => appendToExpression('7') },
    { label: '8', action: () => appendToExpression('8') },
    { label: '9', action: () => appendToExpression('9') },
    { label: '×', action: () => appendToExpression('*') },

    { label: '^', action: () => appendToExpression('^') },
    { label: '4', action: () => appendToExpression('4') },
    { label: '5', action: () => appendToExpression('5') },
    { label: '6', action: () => appendToExpression('6') },
    { label: '-', action: () => appendToExpression('-') },

    { label: 'pi', action: () => appendToExpression('pi') },
    { label: '1', action: () => appendToExpression('1') },
    { label: '2', action: () => appendToExpression('2') },
    { label: '3', action: () => appendToExpression('3') },
    { label: '+', action: () => appendToExpression('+') },

    { label: 'e', action: () => appendToExpression('e') },
    { label: '0', action: () => appendToExpression('0') },
    { label: '.', action: () => appendToExpression('.') },
    { label: '=', action: calculate, className: 'col-span-2 bg-[var(--color-accent)] text-slate-900 font-semibold' },
  ];

  return (
    <div className="app-card h-full p-5 sm:p-6 flex flex-col">
      <div className="flex w-full items-center gap-2 mb-6">
        <div className="rounded-xl bg-blue-500/10 p-2">
          <CalculatorIcon className="h-5 w-5 text-blue-400" />
        </div>
        <h2 className="text-lg font-semibold text-white">Scientific Calculator</h2>
      </div>

      <div className="mb-6 flex flex-col gap-2 rounded-2xl border border-white/10 bg-black/40 p-4 text-right font-mono">
        <div className="h-8 overflow-x-auto whitespace-nowrap text-xl text-[var(--color-muted)]">
          {expression || '0'}
        </div>
        <div className="h-10 overflow-x-auto whitespace-nowrap text-3xl font-bold text-white">
          {result || '='}
        </div>
      </div>

      <div className="grid flex-1 grid-cols-5 gap-2">
        {buttons.map((btn, idx) => (
          <button
            key={idx}
            onClick={btn.action}
            className={`flex items-center justify-center rounded-xl border border-white/5 bg-white/5 p-3 text-sm transition-colors hover:bg-white/10 active:scale-95 ${btn.className || 'text-white'}`}
          >
            {btn.label === '⌫' ? <Delete className="h-4 w-4" /> : btn.label}
          </button>
        ))}
      </div>
    </div>
  );
}
