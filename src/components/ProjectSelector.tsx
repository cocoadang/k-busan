import React from 'react';
import { REDEVELOPMENT_SEED_PROJECTS } from '../registry/redevelopmentRegistry.ts';
import { getProjectPlanConfig } from '../data/projects/planRegistry.ts';

export function ProjectSelector({selectedId, onSelect, idPrefix}: {
  selectedId: string; onSelect: (id: string) => void; idPrefix: string;
}) {
  return <div className="grid grid-cols-3 gap-1.5 sm:flex sm:flex-wrap sm:items-center sm:gap-2 w-full min-w-0">
    {REDEVELOPMENT_SEED_PROJECTS.map(project => <button key={project.id}
      id={`${idPrefix}-${project.id}`} onClick={() => onSelect(project.id)}
      aria-pressed={selectedId === project.id}
      className={`min-h-[44px] px-2 sm:px-4 py-2 rounded-xl text-xs font-bold cursor-pointer break-keep ${selectedId === project.id ? 'bg-blue-600 text-white' : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'}`}>
      {getProjectPlanConfig(project.id)?.displayName || project.aliases[0] || project.name}
    </button>)}
  </div>;
}
