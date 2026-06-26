'use client';

import { useState, useMemo } from 'react';
import { DOC_GUIDES, type DocSection as DocSectionType } from './content';
import { DocSectionCard } from './DocSection';

const GUIDE_TABS = [
  { key: 'user' as const, label: 'User Guide' },
  { key: 'pm' as const, label: 'PM Guide' },
  { key: 'contributor' as const, label: 'Developer Guide' },
  { key: 'admin' as const, label: 'Admin Guide' },
];

function getDefaultGuide(role: string): string {
  if (role === 'owner' || role === 'admin') return 'admin';
  if (role === 'member') return 'contributor';
  return 'user';
}

const ACCENT_CLASSES: Record<string, string> = {
  blue: 'border-blue-500 text-blue-700 bg-blue-50',
  purple: 'border-purple-500 text-purple-700 bg-purple-50',
  green: 'border-green-500 text-green-700 bg-green-50',
  red: 'border-red-500 text-red-700 bg-red-50',
};

interface Props {
  role: string;
  tenantName: string;
  slug: string;
}

export function DocsHub({ role, tenantName, slug: _slug }: Props) {
  const [activeKey, setActiveKey] = useState<string>(getDefaultGuide(role));
  const [search, setSearch] = useState('');

  const activeGuide = useMemo(
    () => DOC_GUIDES.find((g) => g.role === activeKey) ?? DOC_GUIDES[0],
    [activeKey]
  );

  const roleKey = role === 'owner' || role === 'admin' ? role : role === 'member' ? 'member' : 'viewer';
  const visibleSections = useMemo(
    () => activeGuide.sections.filter((s) => s.roles.includes(roleKey as 'owner' | 'admin' | 'member' | 'viewer')),
    [activeGuide, roleKey]
  );

  const filteredSections = useMemo((): DocSectionType[] => {
    if (!search.trim()) return visibleSections;
    const q = search.toLowerCase();
    return visibleSections
      .map((section) => {
        const matchSection =
          section.title.toLowerCase().includes(q) ||
          section.description.toLowerCase().includes(q);
        const matchingSteps = section.steps.filter(
          (s) =>
            s.title.toLowerCase().includes(q) ||
            s.description.toLowerCase().includes(q) ||
            (s.tip?.toLowerCase().includes(q) ?? false)
        );
        if (matchSection || matchingSteps.length > 0) {
          return { ...section, steps: matchSection ? section.steps : matchingSteps };
        }
        return null;
      })
      .filter((s): s is DocSectionType => s !== null);
  }, [activeGuide, search]);

  const accentClass = ACCENT_CLASSES[activeGuide.color] ?? ACCENT_CLASSES.blue;

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Forge Documentation</h1>
            <p className="text-sm text-gray-500 mt-0.5">{tenantName} workspace</p>
          </div>
          <input
            type="text"
            placeholder="Search docs…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-60 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex gap-1">
          {GUIDE_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => { setActiveKey(tab.key); setSearch(''); }}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                activeKey === tab.key
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-1">
        {/* Sidebar */}
        <aside className="hidden lg:block w-56 shrink-0 bg-white border-r border-gray-200 p-4 overflow-y-auto">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            In this guide
          </p>
          <nav className="space-y-1">
            {activeGuide.sections.map((section) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                className="flex items-center gap-2 px-2 py-1.5 text-sm text-gray-600 rounded hover:bg-gray-100 hover:text-gray-900"
              >
                <span>{section.icon}</span>
                <span className="truncate">{section.title}</span>
              </a>
            ))}
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 p-6 overflow-y-auto">
          <div className={`border-l-4 pl-4 mb-8 ${accentClass}`}>
            <h2 className="text-xl font-bold">{activeGuide.title}</h2>
            <p className="text-sm mt-1 opacity-80">{activeGuide.subtitle}</p>
          </div>

          {filteredSections.length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              <p className="text-lg font-medium">No results for &ldquo;{search}&rdquo;</p>
              <p className="text-sm mt-1">Try a different keyword</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredSections.map((section, i) => (
                <DocSectionCard key={section.id} section={section} defaultOpen={i === 0} />
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
