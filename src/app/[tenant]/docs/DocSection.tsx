'use client';

import { useState } from 'react';
import type { DocSection } from './content';

interface Props {
  section: DocSection;
  defaultOpen?: boolean;
}

export function DocSectionCard({ section, defaultOpen = false }: Props) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div id={section.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-gray-50 transition-colors"
      >
        <span className="text-2xl shrink-0">{section.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-gray-900">{section.title}</h3>
            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full shrink-0">
              {section.steps.length} steps
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-0.5 truncate">{section.description}</p>
        </div>
        <span
          className={`text-gray-400 shrink-0 transition-transform duration-200 ${
            open ? 'rotate-180' : ''
          }`}
        >
          ▼
        </span>
      </button>

      {open && (
        <div className="border-t border-gray-100 px-5 py-4 space-y-5">
          {section.overview && (
            <p className="text-sm text-gray-600 leading-relaxed bg-gray-50 border border-gray-100 rounded-lg px-4 py-3">
              {section.overview}
            </p>
          )}
          {section.steps.map((step) => (
            <div key={step.step} className="flex gap-4">
              <div className="shrink-0 w-7 h-7 rounded-full bg-gray-900 text-white text-xs font-bold flex items-center justify-center mt-0.5">
                {step.step}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 text-sm">{step.title}</p>
                <p className="text-sm text-gray-600 mt-1 leading-relaxed">{step.description}</p>
                {step.tip && (
                  <div className="mt-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    <p className="text-xs text-amber-800">
                      <span className="font-semibold">Tip: </span>
                      {step.tip}
                    </p>
                  </div>
                )}
              </div>
            </div>
          ))}
          {section.commonIssues && section.commonIssues.length > 0 && (
            <div className="pt-2 border-t border-gray-100">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Common issues</p>
              <div className="space-y-2">
                {section.commonIssues.map((ci, i) => (
                  <div key={i} className="bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">
                    <p className="text-xs font-semibold text-rose-800">{ci.problem}</p>
                    <p className="text-xs text-rose-700 mt-0.5">{ci.fix}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
