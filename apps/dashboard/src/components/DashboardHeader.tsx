import React from 'react';
import { ChefHat, RefreshCw, Power, Settings as SettingsIcon, LogOut, Clock } from 'lucide-react';
import { SystemSettings } from '../types';

interface DashboardHeaderProps {
  loadingData: boolean;
  settings: SystemSettings;
  heartbeatStatus: 'online' | 'warning' | 'offline';
  lastHeartbeat: Date;
  activeTab: string;
  setActiveTab: (tab: 'kanban' | 'handoff' | 'settings' | 'history') => void;
  handleLogout: () => void;
}

export function DashboardHeader({
  loadingData,
  settings,
  heartbeatStatus,
  lastHeartbeat,
  activeTab,
  setActiveTab,
  handleLogout
}: DashboardHeaderProps) {
  return (
    <header className="h-16 border-b border-zinc-800/80 px-4 md:px-6 flex items-center justify-between backdrop-blur-md bg-zinc-950/80 z-10 flex-shrink-0">
      <div className="flex items-center gap-3">
        <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-tr from-amber-500 to-amber-300 shadow-sm shadow-amber-500/20">
          <ChefHat className="h-5 w-5 text-zinc-950" />
        </div>
        <div>
          <h1 className="font-bold text-white tracking-tight leading-none text-lg">Shelby OS</h1>
          <span className="text-[9px] font-medium uppercase tracking-wider text-amber-400">Kitchen Dashboard</span>
        </div>
      </div>
      
      {/* Status & Quick Controls */}
      <div className="flex items-center gap-3 md:gap-4">
        {loadingData && <RefreshCw className="h-4 w-4 text-amber-500 animate-spin" />}
        {settings.digital_lane_paused && (
          <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold animate-pulse">
            <Power className="h-3.5 w-3.5" />
            <span>Kill Switch On</span>
          </div>
        )}
        <div className="hidden md:flex items-center gap-2 px-3 border-l border-zinc-800">
          <div className={`h-2 w-2 rounded-full ${heartbeatStatus === 'online' ? 'bg-emerald-500' : 'bg-red-500'}`} />
          <span className="text-xs text-zinc-400 font-mono">{lastHeartbeat.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
        <button 
          onClick={() => setActiveTab(activeTab === 'history' ? 'kanban' : 'history')} 
          className={`p-1.5 rounded-lg transition-colors border ${activeTab === 'history' ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' : 'border-transparent text-zinc-400 hover:text-white hover:bg-zinc-800'}`}
          title="History & Archive"
        >
          <Clock className="h-4 w-4" />
        </button>
        <button 
          onClick={() => setActiveTab(activeTab === 'settings' ? 'kanban' : 'settings')} 
          className={`p-1.5 rounded-lg transition-colors border ${activeTab === 'settings' ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' : 'border-transparent text-zinc-400 hover:text-white hover:bg-zinc-800'}`}
          title="System Settings"
        >
          <SettingsIcon className="h-4 w-4" />
        </button>
        <button 
          onClick={handleLogout} 
          className="p-1.5 border border-transparent text-zinc-400 hover:text-red-400 hover:bg-zinc-800 rounded-lg transition-colors"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
