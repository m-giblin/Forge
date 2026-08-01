'use client';

import { useMemo, useState } from 'react';
import type { DocSection } from './content';
import { extractHeadings } from './blocks';
import { DocRenderer } from './DocRenderer';
import { DocToc } from './DocToc';

interface Props {
  section: DocSection;
  defaultOpen?: boolean;
}

export function DocSectionCard({ section, defaultOpen = false }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const hasBlocks = !!section.blocks && section.blocks.length > 0;
  const headings = useMemo(() => (hasBlocks ? extractHeadings(section.blocks!) : []), [hasBlocks, section.blocks]);

  return (
    <div id={section.id} className="bg-[#faf8f2] border border-[#ddd8c9] rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-[#f4f2eb] transition-colors"
      >
        <span className="text-2xl shrink-0">{section.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-[#20201d]">{section.title}</h3>
            {!hasBlocks && (
              <span className="text-xs text-[#a19d90] bg-[#f1efe9] px-2 py-0.5 rounded-full shrink-0">
                {(section.steps ?? []).length} steps
              </span>
            )}
          </div>
          <p className="text-sm text-[#726e60] mt-0.5 truncate">{section.description}</p>
        </div>
        <span
          className={`text-[#a19d90] shrink-0 transition-transform duration-200 ${
            open ? 'rotate-180' : ''
          }`}
        >
          ▼
        </span>
      </button>

      {open && hasBlocks && (
        <div className="border-t border-[#ddd8c9] flex gap-6 px-5 py-5">
          <div className="flex-1 min-w-0">
            <DocRenderer blocks={section.blocks!} />
          </div>
          {headings.length >= 2 && (
            <div className="hidden lg:block w-44 shrink-0">
              <div className="sticky top-4">
                <DocToc headings={headings} />
              </div>
            </div>
          )}
        </div>
      )}

      {open && !hasBlocks && (
        <div className="border-t border-[#ddd8c9] px-5 py-4 space-y-5">
          {section.overview && (
            <p className="text-sm text-[#4a473e] leading-relaxed bg-[#f4f2eb] border border-[#ddd8c9] rounded-lg px-4 py-3">
              {section.overview}
            </p>
          )}
          {(section.steps ?? []).map((step) => (
            <div key={step.step} className="flex gap-4">
              <div className="shrink-0 w-7 h-7 rounded-full bg-[#20201d] text-white text-xs font-bold flex items-center justify-center mt-0.5">
                {step.step}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-[#20201d] text-sm">{step.title}</p>
                <p className="text-sm text-[#4a473e] mt-1 leading-relaxed">{step.description}</p>
                {step.tip && (
                  <div className="mt-2 bg-[#fdf1de] border border-[#c9791d]/30 rounded-lg px-3 py-2">
                    <p className="text-xs text-[#c9791d]">
                      <span className="font-semibold">Tip: </span>
                      {step.tip}
                    </p>
                  </div>
                )}
              </div>
            </div>
          ))}
          {section.commonIssues && section.commonIssues.length > 0 && (
            <div className="pt-2 border-t border-[#ddd8c9]">
              <p className="text-xs font-semibold text-[#a19d90] uppercase tracking-wide mb-2">Common issues</p>
              <div className="space-y-2">
                {section.commonIssues.map((ci, i) => (
                  <div key={i} className="bg-[#fbeae8] border border-[#c0392b]/20 rounded-lg px-3 py-2">
                    <p className="text-xs font-semibold text-[#c0392b]">{ci.problem}</p>
                    <p className="text-xs text-[#c0392b] mt-0.5">{ci.fix}</p>
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
