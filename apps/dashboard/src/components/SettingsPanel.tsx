import React from 'react';
import { Power, CloudRain } from 'lucide-react';
import { SystemSettings, CurrentUser } from '../types';

interface SettingsPanelProps {
  settings: SystemSettings;
  updateSetting: (key: string, value: unknown) => Promise<void>;
  currentUser: CurrentUser | null;
}

export function SettingsPanel({ settings, updateSetting, currentUser }: SettingsPanelProps) {
  return (
    <div className="w-full max-w-3xl mx-auto p-4 md:p-8 overflow-y-auto">
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-3xl p-6 md:p-8 space-y-8 backdrop-blur-sm shadow-xl">
        <div className="border-b border-zinc-800 pb-4">
          <h2 className="text-xl font-bold text-white">System Settings</h2>
          <p className="text-sm text-zinc-400">Configure parameters and overrides.</p>
        </div>
        
        <div className="space-y-6">
          <SettingToggle 
            icon={<Power className="h-5 w-5" />} title="Kill Switch (Pause Orders)" 
            desc="Stops accepting new digital orders."
            active={settings.digital_lane_paused} color="bg-red-500" 
            onToggle={() => updateSetting('digital_lane_paused', !settings.digital_lane_paused)} 
            disabled={currentUser?.role !== 'admin'} 
          />
          <SettingToggle 
            icon={<CloudRain className="h-5 w-5" />} title="Rain Protocol" 
            desc="Adapts menu and increases buffers automatically."
            active={settings.rain_protocol_active} color="bg-blue-500" 
            onToggle={() => updateSetting('rain_protocol_active', !settings.rain_protocol_active)} 
            disabled={currentUser?.role !== 'admin'} 
          />
        </div>
      </div>
    </div>
  );
}

interface SettingToggleProps {
  icon: React.ReactNode;
  title: string;
  desc: string;
  active: boolean;
  color: string;
  onToggle: () => void;
  disabled?: boolean;
}

function SettingToggle({ icon, title, desc, active, color, onToggle, disabled }: SettingToggleProps) {
  return (
    <div className="flex items-center justify-between p-4 md:p-5 rounded-2xl bg-zinc-950/50 border border-zinc-800/80">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${active ? color+'/20 text-'+color.split('-')[1]+'-400' : 'bg-zinc-800 text-zinc-400'}`}>
           {icon}
        </div>
        <div>
          <h4 className="font-bold text-white text-sm md:text-base">{title}</h4>
          <p className="text-[10px] md:text-xs text-zinc-400">{desc}</p>
        </div>
      </div>
      <button
        onClick={onToggle}
        disabled={disabled}
        className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none ${active ? color : 'bg-zinc-700'} ${disabled ? 'opacity-50' : ''}`}
      >
        <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${active ? 'translate-x-6' : 'translate-x-1'}`} />
      </button>
    </div>
  );
}
