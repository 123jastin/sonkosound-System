/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { BusinessSettings } from '../types';
import { LocalDatabase, hashPassword } from '../db';
import { 
  Settings, KeyRound, Database, ArrowUp, ArrowDown, 
  Trash2, RefreshCw, Smartphone, MapPin, Building, Eye, EyeOff, Save, ShieldAlert, Check
} from 'lucide-react';

interface SettingsViewProps {
  onUpdate: () => void;
  onLogout: () => void;
}

export default function SettingsView({ onUpdate, onLogout }: SettingsViewProps) {
  const [settings, setSettings] = useState<BusinessSettings>(() => LocalDatabase.getSettings());
  
  // Security Form
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [pinError, setPinError] = useState('');
  const [pinSuccess, setPinSuccess] = useState(false);

  // Status alerts
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Handlers - Save Settings
  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    LocalDatabase.saveSettings(settings);
    LocalDatabase.logTransaction('Customer Updated', 'Updated business profile settings');
    setSaveSuccess(true);
    onUpdate();
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  // Handlers - Change Password PIN
  const handleChangePin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPin || !newPin) return;

    const currentHash = hashPassword(currentPin);
    const storedHash = LocalDatabase.getPasswordHash();

    if (currentHash !== storedHash) {
      setPinError('PIN ya sasa si sahihi. Tafadhali jaribu tena.');
      setPinSuccess(false);
      return;
    }

    if (newPin.length < 4) {
      setPinError('PIN mpya lazima iwe na angalau nambari 4 au zaidi.');
      setPinSuccess(false);
      return;
    }

    LocalDatabase.savePassword(newPin);
    LocalDatabase.logTransaction('Customer Updated', 'Successfully changed security access PIN');
    
    setPinError('');
    setPinSuccess(true);
    setCurrentPin('');
    setNewPin('');
    setTimeout(() => setPinSuccess(false), 4000);
  };

  // Handlers - Export JSON Backup
  const handleExportBackup = () => {
    const dataStr = LocalDatabase.exportDatabase();
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `TSh_Ledger_Backup_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    LocalDatabase.logTransaction('Customer Created', 'Downloaded manual database backup JSON file');
  };

  // Handlers - Restore JSON Backup
  const handleRestoreBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const success = LocalDatabase.restoreDatabase(content);
      if (success) {
        alert('Data imerejeshwa vizuri sana! Programu itapakia upya sasa.');
        onUpdate();
        window.location.reload();
      } else {
        alert('Hitilafu: Faili hii si ya hifadhi halali ya Ledger (JSON file is corrupted).');
      }
    };
    reader.readAsText(file);
  };

  // Handlers - Factory Reset
  const handleFactoryReset = () => {
    const firstCheck = confirm("Je, una uhakika kabisa unataka kufuta data YOTE? Kitendo hiki kitaondoa wateja wote, madeni, malipo na kuweka upya PIN kuwa '1234'.");
    if (!firstCheck) return;

    const secondCheck = confirm("ONYO LA MWISHO: Kitendo hiki hakiwezi kurejeshwa tena (cannot be undone). Bonyeza OK kufuta kabisa.");
    if (!secondCheck) return;

    LocalDatabase.resetDatabase();
    onLogout();
    window.location.reload();
  };

  return (
    <div className="space-y-8 pb-12">
      
      {/* Settings Header */}
      <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <Settings size={20} className="text-accent" />
          Mipangilio ya Programu na Biashara (Settings)
        </h2>
        <p className="text-xs text-slate-400 mt-1">Sanidi taarifa za risiti, nembo ya biashara, usalama, na hifadhi ya kumbukumbu zako.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Left Side: Business brand customizations */}
        <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm space-y-6">
          <h3 className="text-sm font-extrabold text-slate-850 border-b border-slate-50 pb-3 flex items-center gap-2">
            <Building size={16} className="text-accent" />
            Wasifu wa Biashara (Business Profile)
          </h3>

          <form onSubmit={handleSaveSettings} className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Jina la Biashara (Business Name)</label>
              <div className="relative rounded-xl shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 pointer-events-none">
                  <Building size={14} />
                </div>
                <input 
                  type="text" 
                  required
                  value={settings.businessName} 
                  onChange={(e) => setSettings(prev => ({ ...prev, businessName: e.target.value }))}
                  className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl" 
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Namba ya Simu ya Ofisi</label>
                <div className="relative rounded-xl shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 pointer-events-none">
                    <Smartphone size={14} />
                  </div>
                  <input 
                    type="tel" 
                    required
                    value={settings.businessPhone} 
                    onChange={(e) => setSettings(prev => ({ ...prev, businessPhone: e.target.value }))}
                    className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl" 
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Anuani / Mahali Ofisi ilipo</label>
                <div className="relative rounded-xl shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 pointer-events-none">
                    <MapPin size={14} />
                  </div>
                  <input 
                    type="text" 
                    required
                    value={settings.businessAddress} 
                    onChange={(e) => setSettings(prev => ({ ...prev, businessAddress: e.target.value }))}
                    className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl" 
                  />
                </div>
              </div>
            </div>



            <div className="pt-2">
              <button 
                type="submit"
                className="bg-accent hover:bg-accent/90 text-white font-semibold py-2.5 px-5 rounded-xl flex items-center gap-1.5 shadow-sm transition"
              >
                <Save size={15} /> Hifadhi Mabadiliko
              </button>
            </div>

            {saveSuccess && (
              <p className="text-xs text-accent font-bold bg-accent/10 p-3 rounded-xl border border-accent/20 flex items-center gap-1.5 animate-fade-in">
                <Check size={14} /> Taarifa zimehifadhiwa kikamilifu kwenye kivinjari chako!
              </p>
            )}
          </form>
        </div>

        {/* Right Side: Password Security & Database backups */}
        <div className="space-y-8">
          
          {/* Change Security access PIN */}
          <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-extrabold text-slate-850 border-b border-slate-50 pb-3 flex items-center gap-2">
              <KeyRound size={16} className="text-accent" />
              Nenosiri la Mfumo (Security PIN changer)
            </h3>

            <form onSubmit={handleChangePin} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1.5">PIN ya sasa *</label>
                  <input 
                    type="password" 
                    required
                    value={currentPin}
                    onChange={(e) => setCurrentPin(e.target.value)}
                    placeholder="PIN ya kale"
                    className="w-full p-2.5 border border-slate-200 rounded-xl" 
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1.5">PIN Mpya *</label>
                  <input 
                    type="password" 
                    required
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value)}
                    placeholder="PIN mpya ya sasa"
                    className="w-full p-2.5 border border-slate-200 rounded-xl" 
                  />
                </div>
              </div>

              <div className="pt-1">
                <button 
                  type="submit"
                  className="bg-slate-900 hover:bg-slate-850 text-white font-semibold py-2.5 px-5 rounded-xl transition"
                >
                  Badilisha PIN Salama
                </button>
              </div>

              {pinError && <p className="text-xs text-rose-500 font-semibold">{pinError}</p>}
              {pinSuccess && (
                <p className="text-xs text-accent font-bold bg-accent/10 p-3 rounded-xl border border-accent/20 flex items-center gap-1">
                  <Check size={14} /> PIN mpya imehifadhiwa kwa usalama!
                </p>
              )}
            </form>
          </div>

          {/* Database Admin Backups */}
          <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm space-y-5">
            <h3 className="text-sm font-extrabold text-slate-850 border-b border-slate-50 pb-3 flex items-center gap-2">
              <Database size={16} className="text-accent" />
              Kuhifadhi na Kurejesha Kumbukumbu (Data Backup)
            </h3>

            <p className="text-xs text-slate-500 leading-relaxed">
              Data yako yote ya Ledger inahifadhiwa ndani ya kifaa chako kwa usalama. Unaweza kupakua nakala ya kumbukumbu zako zote ili uzihifadhi nje ya kivinjari au kuzihamishia kwenye simu nyingine.
            </p>

            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={handleExportBackup}
                className="w-full bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-2xl p-4 text-center transition flex flex-col items-center justify-center gap-2 cursor-pointer"
              >
                <ArrowDown size={22} className="text-accent" />
                <span className="text-xs font-bold text-slate-800">Pakua Nakala (JSON Backup)</span>
                <span className="text-[10px] text-slate-400">Download data yote</span>
              </button>

              <label
                className="w-full bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-2xl p-4 text-center transition flex flex-col items-center justify-center gap-2 cursor-pointer"
              >
                <ArrowUp size={22} className="text-sky-600" />
                <span className="text-xs font-bold text-slate-800">Rejesha Nakala (Upload)</span>
                <span className="text-[10px] text-slate-400">Weka faili ya .json</span>
                <input 
                  type="file" 
                  accept=".json"
                  onChange={handleRestoreBackup}
                  className="hidden" 
                />
              </label>
            </div>

            {/* Dangerous Factory Reset Area */}
            <div className="border-t border-slate-100 pt-5 mt-2">
              <div className="p-4 bg-rose-50 rounded-2xl border border-rose-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-rose-800 flex items-center gap-1">
                    <ShieldAlert size={14} />
                    Futa Data zote (Danger Zone)
                  </h4>
                  <p className="text-[10px] text-rose-600">
                    Futa data yote ya kivinjari na urudishe programu kwenye hali ya kiwandani.
                  </p>
                </div>
                <button
                  onClick={handleFactoryReset}
                  className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold py-2 px-4 rounded-xl shadow-sm transition whitespace-nowrap"
                >
                  Factory Reset
                </button>
              </div>
            </div>

          </div>

        </div>

      </div>

    </div>
  );
}
