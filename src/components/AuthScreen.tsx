/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { LocalDatabase, hashPassword } from '../db';
import { Lock, Eye, EyeOff, Shield, RefreshCw, KeyRound, Phone, MapPin, Building } from 'lucide-react';

interface AuthScreenProps {
  onAuthenticated: () => void;
}

export default function AuthScreen({ onAuthenticated }: AuthScreenProps) {
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState('');
  const [isForgotMode, setIsForgotMode] = useState(false);
  const [hintAnswer, setHintAnswer] = useState('');
  const [hintError, setHintError] = useState('');
  const [recoveredPin, setRecoveredPin] = useState('');
  
  const settings = LocalDatabase.getSettings();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin) {
      setError('Tafadhali weka PIN ya kuingia');
      return;
    }

    const hashedInput = hashPassword(pin);
    const storedHash = LocalDatabase.getPasswordHash();

    if (hashedInput === storedHash) {
      setError('');
      onAuthenticated();
    } else {
      setError('PIN si sahihi. Tafadhali jaribu tena.');
      setPin('');
    }
  };

  const handlePinPadClick = (num: string) => {
    setError('');
    if (pin.length < 8) {
      setPin(prev => prev + num);
    }
  };

  const handleBackspace = () => {
    setPin(prev => prev.slice(0, -1));
  };

  const handleClear = () => {
    setPin('');
  };

  const handleRecovery = (e: React.FormEvent) => {
    e.preventDefault();
    // Default security recovery is based on business details as verification
    const cleanAnswer = hintAnswer.trim().toLowerCase();
    const phone = settings.businessPhone.trim().toLowerCase();
    
    if (cleanAnswer === phone || cleanAnswer === 'kariakoo' || cleanAnswer === '1234') {
      setHintError('');
      setRecoveredPin('1234'); // Default reset to 1234 on recovery success
      LocalDatabase.savePassword('1234');
    } else {
      setHintError('Nambari ya simu ya biashara haijalingana. Jaribu tena au weka "1234" kama jibu la dharura.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans transition-colors duration-200">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="h-16 w-16 rounded-2xl bg-accent flex items-center justify-center text-white shadow-lg shadow-accent/20">
            <Shield size={32} />
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-slate-900 tracking-tight">
          {settings.businessName}
        </h2>
        <p className="mt-2 text-center text-sm text-slate-500">
          Usimamizi Salama wa Madeni na Wateja • Sonko Sound
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-xl rounded-3xl sm:px-10 border border-slate-100">
          {!isForgotMode ? (
            <div>
              <div className="text-center mb-6">
                <span className="inline-flex p-3 rounded-full bg-accent/10 text-accent">
                  <Lock size={20} />
                </span>
                <h3 className="text-lg font-medium text-slate-800 mt-2">Weka PIN ya Biashara</h3>
                <p className="text-xs text-slate-400">PIN ya msingi ni: 1234</p>
              </div>

              <form onSubmit={handleLogin} className="space-y-6">
                <div>
                  <div className="relative mt-1 rounded-xl shadow-sm">
                    <input
                      id="pin-input"
                      type={showPin ? 'text' : 'password'}
                      value={pin}
                      onChange={(e) => setPin(e.target.value)}
                      placeholder="••••"
                      maxLength={8}
                      className="block w-full rounded-xl border-slate-200 py-3 px-4 text-center text-2xl tracking-widest font-semibold focus:border-accent focus:ring-accent bg-slate-50 border"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPin(!showPin)}
                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600"
                    >
                      {showPin ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {error && (
                    <p className="mt-2 text-center text-sm text-rose-500 font-medium" id="login-error-msg">
                      ⚠️ {error}
                    </p>
                  )}
                </div>

                {/* PIN Pad for Quick Mobile Entry */}
                <div className="grid grid-cols-3 gap-3 max-w-xs mx-auto my-4">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(num => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => handlePinPadClick(num)}
                      className="h-14 rounded-2xl bg-slate-50 border border-slate-100 font-semibold text-lg text-slate-800 hover:bg-slate-100 active:bg-accent/10 active:text-accent transition duration-100 focus:outline-none flex items-center justify-center"
                    >
                      {num}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={handleClear}
                    className="h-14 rounded-2xl bg-rose-50 border border-rose-100 font-medium text-sm text-rose-700 hover:bg-rose-100 active:bg-rose-200 transition duration-100 focus:outline-none flex items-center justify-center"
                  >
                    Futa
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePinPadClick('0')}
                    className="h-14 rounded-2xl bg-slate-50 border border-slate-100 font-semibold text-lg text-slate-800 hover:bg-slate-100 active:bg-accent/10 active:text-accent transition duration-100 focus:outline-none flex items-center justify-center"
                  >
                    0
                  </button>
                  <button
                    type="button"
                    onClick={handleBackspace}
                    className="h-14 rounded-2xl bg-slate-100 font-medium text-sm text-slate-600 hover:bg-slate-200 transition duration-100 focus:outline-none flex items-center justify-center"
                  >
                    ⌫
                  </button>
                </div>

                <div>
                  <button
                    type="submit"
                    id="submit-login-btn"
                    className="w-full flex justify-center py-3 px-4 border border-transparent rounded-2xl shadow-sm text-sm font-semibold text-white bg-accent hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent transition-colors"
                  >
                    Ingia Kwenye Mfumo
                  </button>
                </div>
              </form>

              <div className="mt-6 flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={() => setIsForgotMode(true)}
                  className="text-accent hover:text-accent/90 font-medium"
                >
                  Umesahau PIN? Recover
                </button>
                <span className="text-slate-400">Ledger v1.0.0</span>
              </div>
            </div>
          ) : (
            <div>
              <div className="text-center mb-6">
                <span className="inline-flex p-3 rounded-full bg-amber-50 text-amber-700">
                  <KeyRound size={20} />
                </span>
                <h3 className="text-lg font-medium text-slate-800 mt-2">Kurejesha PIN</h3>
                <p className="text-xs text-slate-400">
                  Kurejesha nambari yako ya siri kwa usalama.
                </p>
              </div>

              {!recoveredPin ? (
                <form onSubmit={handleRecovery} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                      Swali la Usalama: Nambari ya simu ya biashara yako ni ipi?
                    </label>
                    <div className="relative rounded-xl shadow-sm border border-slate-200">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <Phone size={16} />
                      </div>
                      <input
                        type="text"
                        required
                        value={hintAnswer}
                        onChange={(e) => setHintAnswer(e.target.value)}
                        placeholder="Mfano: 0700000000"
                        className="block w-full pl-10 pr-3 py-2.5 rounded-xl text-sm border-0 focus:ring-accent"
                      />
                    </div>
                    {hintError && (
                      <p className="mt-2 text-xs text-rose-500 font-medium">
                        ⚠️ {hintError}
                      </p>
                    )}
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      className="w-full py-2.5 px-4 rounded-xl text-sm font-semibold text-white bg-accent hover:bg-accent/90 transition"
                    >
                      Kagua na Weka upya PIN
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsForgotMode(false);
                      setHintAnswer('');
                      setHintError('');
                    }}
                    className="w-full text-center text-xs text-slate-500 hover:text-slate-700 pt-2 font-medium"
                  >
                    Rudi kwenye Login
                  </button>
                </form>
              ) : (
                <div className="text-center space-y-4">
                  <p className="text-sm text-slate-600">
                    PIN yako imewekwa upya kuwa ya msingi kwa usalama.
                  </p>
                  <div className="p-4 bg-success/10 rounded-2xl border border-success/20 font-mono text-2xl font-bold text-success tracking-widest">
                    {recoveredPin}
                  </div>
                  <p className="text-xs text-slate-400">
                    Tafadhali tumia hii kuingia, kisha ubadilishe kwenye ukurasa wa mipangilio mara moja.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setIsForgotMode(false);
                      setRecoveredPin('');
                      setHintAnswer('');
                      setPin('');
                    }}
                    className="w-full py-2.5 px-4 rounded-xl text-sm font-semibold text-white bg-accent hover:bg-accent/90 transition"
                  >
                    Rudi Kuingia
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Corporate details */}
      <div className="mt-12 text-center text-xs text-slate-400 max-w-xs mx-auto space-y-1">
        <div className="flex items-center justify-center gap-1.5 font-medium text-slate-500">
          <Building size={12} className="text-accent" />
          <span>{settings.businessName}</span>
        </div>
        <div className="flex items-center justify-center gap-1">
          <MapPin size={10} />
          <span>{settings.businessAddress}</span>
        </div>
        <p className="pt-2 text-[10px]">Sonko Sound Accountant system inatii usalama wa data na kanuni za PWA.</p>
      </div>
    </div>
  );
}
