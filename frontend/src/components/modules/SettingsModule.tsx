import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { api } from '../../api/client';
import { triggerHaptic } from '../../utils/haptics';
import { Sliders, Sun, Moon, Vibrate, ShieldCheck, CheckCircle2 } from 'lucide-react';

export const SettingsModule: React.FC = () => {
  const { activeOrg, theme, themeMode, setThemeMode, effectiveTheme, toggleTheme, addToast } = useApp();
  const [settings, setSettings] = useState<any>({
    fairness_weight: 1.0,
    preference_weight: 1.0,
    overtime_penalty_weight: 1.5,
    max_weekly_hours: 40.0,
    allow_emergency_self_report: true,
    require_manager_approval_for_swap: true,
    auto_replacement_search: true,
    haptic_feedback_enabled: true,
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!activeOrg) return;
    api.getSettings(activeOrg.id).then(setSettings).catch(console.error);
  }, [activeOrg]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrg) return;
    triggerHaptic(20);
    setIsSaving(true);
    try {
      await api.updateSettings(activeOrg.id, settings);
      localStorage.setItem('smart_sched_haptics', String(settings.haptic_feedback_enabled));
      addToast('Settings Saved', 'Organization policies and optimization weights updated', 'success');
    } catch (err: any) {
      addToast('Error', err.message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestHaptics = () => {
    triggerHaptic([30, 60, 30]);
    addToast('Haptics Tested', 'Vibration pulse sent if supported on this device', 'info');
  };

  return (
    <form onSubmit={handleSave} className="space-y-6 animate-in fade-in duration-300 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <Sliders className="w-6 h-6 text-blue-500" />
            <span>Organization & Engine Settings</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Configure constraint weights, approval workflows, theme preferences, and haptic feedback.
          </p>
        </div>

        <button
          type="submit"
          disabled={isSaving}
          className="px-6 py-2.5 rounded-xl glass-button-primary text-xs font-semibold"
        >
          {isSaving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      {/* Section 1: Optimization Weights */}
      <div className="p-6 rounded-3xl glass-panel border border-white/40 dark:border-white/10 space-y-4">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">
          OR-Tools Constraint Optimization Weights
        </h3>

        <div className="space-y-4 text-xs">
          <div>
            <div className="flex justify-between font-semibold mb-1">
              <span>Fairness & Balance Weight:</span>
              <span className="text-blue-500 font-bold">{settings.fairness_weight}x</span>
            </div>
            <input
              type="range"
              min="0.2"
              max="2.5"
              step="0.1"
              value={settings.fairness_weight}
              onChange={(e) => setSettings({ ...settings, fairness_weight: Number(e.target.value) })}
              className="w-full accent-blue-600"
            />
          </div>

          <div>
            <div className="flex justify-between font-semibold mb-1">
              <span>Staff Preferences Weight:</span>
              <span className="text-blue-500 font-bold">{settings.preference_weight}x</span>
            </div>
            <input
              type="range"
              min="0.2"
              max="2.5"
              step="0.1"
              value={settings.preference_weight}
              onChange={(e) => setSettings({ ...settings, preference_weight: Number(e.target.value) })}
              className="w-full accent-blue-600"
            />
          </div>

          <div>
            <div className="flex justify-between font-semibold mb-1">
              <span>Overtime Penalty Weight:</span>
              <span className="text-blue-500 font-bold">{settings.overtime_penalty_weight}x</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="3.0"
              step="0.1"
              value={settings.overtime_penalty_weight}
              onChange={(e) => setSettings({ ...settings, overtime_penalty_weight: Number(e.target.value) })}
              className="w-full accent-blue-600"
            />
          </div>
        </div>
      </div>

      {/* Section 2: Operational Policies */}
      <div className="p-6 rounded-3xl glass-panel border border-white/40 dark:border-white/10 space-y-4">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">
          Operational Policies & Approval Rules
        </h3>

        <div className="space-y-3 text-xs">
          <label className="flex items-center gap-3 p-3 rounded-2xl glass-card cursor-pointer">
            <input
              type="checkbox"
              checked={settings.allow_emergency_self_report}
              onChange={(e) => setSettings({ ...settings, allow_emergency_self_report: e.target.checked })}
              className="w-4 h-4 rounded text-blue-600 accent-blue-600"
            />
            <div>
              <div className="font-semibold text-slate-900 dark:text-white">Allow Direct Emergency Self-Reporting</div>
              <div className="text-[11px] text-slate-500">Employees can immediately record emergency absence and trigger replacement coverage.</div>
            </div>
          </label>

          <label className="flex items-center gap-3 p-3 rounded-2xl glass-card cursor-pointer">
            <input
              type="checkbox"
              checked={settings.require_manager_approval_for_swap}
              onChange={(e) => setSettings({ ...settings, require_manager_approval_for_swap: e.target.checked })}
              className="w-4 h-4 rounded text-blue-600 accent-blue-600"
            />
            <div>
              <div className="font-semibold text-slate-900 dark:text-white">Require Manager Authorization for Peer Swaps</div>
              <div className="text-[11px] text-slate-500">Colleague-initiated swap proposals require manager sign-off prior to timetable exchange.</div>
            </div>
          </label>

          <label className="flex items-center gap-3 p-3 rounded-2xl glass-card cursor-pointer">
            <input
              type="checkbox"
              checked={settings.auto_replacement_search}
              onChange={(e) => setSettings({ ...settings, auto_replacement_search: e.target.checked })}
              className="w-4 h-4 rounded text-blue-600 accent-blue-600"
            />
            <div>
              <div className="font-semibold text-slate-900 dark:text-white">Automate Replacement Candidate Search</div>
              <div className="text-[11px] text-slate-500">Automatically rank and recommend qualified replacements upon confirmed leave.</div>
            </div>
          </label>
        </div>
      </div>

      {/* Section 3: UI & Haptics Experience */}
      <div className="p-6 rounded-3xl glass-panel border border-white/40 dark:border-white/10 space-y-4">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">
          Appearance & Touch Haptics
        </h3>

        <div className="p-4 rounded-2xl glass-card text-xs space-y-3">
          <div>
            <div className="font-semibold text-slate-900 dark:text-white">Apple Liquid Glass Appearance Mode</div>
            <div className="text-[11px] text-slate-500">Choose between Light Glass, Dark Glass, or Auto following your device settings.</div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
            <button
              type="button"
              onClick={() => setThemeMode('light')}
              className={`p-3 rounded-xl border transition-all flex flex-col items-center justify-center gap-1.5 text-center ${
                themeMode === 'light'
                  ? 'bg-white text-slate-900 border-blue-500 ring-2 ring-blue-500/20 shadow-md font-bold'
                  : 'glass-pill border-slate-300/40 dark:border-white/10 text-slate-600 dark:text-slate-300'
              }`}
            >
              <Sun className="w-4 h-4 text-amber-500" />
              <span>Light Glass</span>
              <span className="text-[10px] text-slate-400 font-normal">Frosted white & silver</span>
            </button>

            <button
              type="button"
              onClick={() => setThemeMode('dark')}
              className={`p-3 rounded-xl border transition-all flex flex-col items-center justify-center gap-1.5 text-center ${
                themeMode === 'dark'
                  ? 'bg-slate-900 text-white border-blue-500 ring-2 ring-blue-500/20 shadow-md font-bold'
                  : 'glass-pill border-slate-300/40 dark:border-white/10 text-slate-600 dark:text-slate-300'
              }`}
            >
              <Moon className="w-4 h-4 text-blue-400" />
              <span>Dark Glass</span>
              <span className="text-[10px] text-slate-400 font-normal">Black & graphite glass</span>
            </button>

            <button
              type="button"
              onClick={() => setThemeMode('auto')}
              className={`p-3 rounded-xl border transition-all flex flex-col items-center justify-center gap-1.5 text-center ${
                themeMode === 'auto'
                  ? 'bg-blue-600/10 text-blue-600 dark:text-blue-400 border-blue-500 ring-2 ring-blue-500/20 font-bold'
                  : 'glass-pill border-slate-300/40 dark:border-white/10 text-slate-600 dark:text-slate-300'
              }`}
            >
              <Sliders className="w-4 h-4 text-purple-500" />
              <span>Auto (System)</span>
              <span className="text-[10px] text-slate-400 font-normal">Matches device theme ({effectiveTheme})</span>
            </button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-3 rounded-2xl glass-card text-xs">
          <div className="flex items-center gap-3">
            <Vibrate className="w-5 h-5 text-blue-500 flex-shrink-0" />
            <div>
              <div className="font-semibold text-slate-900 dark:text-white">Tactile Haptic Feedback</div>
              <div className="text-[11px] text-slate-500">Vibration API pulses for button taps, schedule generates, and approvals.</div>
            </div>
          </div>
          <button
            type="button"
            onClick={handleTestHaptics}
            className="px-3.5 py-1.5 rounded-xl glass-pill hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 font-semibold self-start sm:self-auto"
          >
            Test Haptic Pulse
          </button>
        </div>
      </div>
    </form>
  );
};
