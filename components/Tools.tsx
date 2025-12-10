
import React, { useState, useMemo } from 'react';
import { Calculator, ArrowRight, RotateCcw, Thermometer, Zap, ThermometerSun, TrendingUp, Flame } from 'lucide-react';

export const Tools: React.FC = () => {
  // --- State for Tool 1: Temp Resistance Compensation (Hot -> Std) ---
  const [material, setMaterial] = useState<'copper' | 'aluminum'>('copper');
  const [rHot, setRHot] = useState<string>(''); // Measured Resistance
  const [tHot, setTHot] = useState<string>(''); // Measured Temp
  const [tStd, setTStd] = useState<string>('20'); // Standard Temp (Target)

  // --- State for Tool 2: Resistance Prediction (Std -> Hot/Target) ---
  const [materialRev, setMaterialRev] = useState<'copper' | 'aluminum'>('copper');
  const [rBase, setRBase] = useState<string>(''); // Standard Resistance
  const [tBase, setTBase] = useState<string>('20'); // Standard Temp
  const [tTarget, setTTarget] = useState<string>(''); // Target/Env Temp

  // Constants
  const CONSTANTS = {
    copper: 234.5,
    aluminum: 228
  };

  // Calculation Logic 1: Hot -> Std
  const result = useMemo(() => {
    const r = parseFloat(rHot);
    const t = parseFloat(tHot);
    const std = parseFloat(tStd);
    const k = CONSTANTS[material];

    if (isNaN(r) || isNaN(t) || isNaN(std)) return null;

    // Formula: R_std = R_hot * ( (T_std + k) / (T_hot + k) )
    const rStd = r * ((std + k) / (t + k));
    return rStd;
  }, [rHot, tHot, tStd, material]);

  // Calculation Logic 2: Std -> Target
  const resultRev = useMemo(() => {
    const r = parseFloat(rBase);
    const tBaseVal = parseFloat(tBase);
    const tTargetVal = parseFloat(tTarget);
    const k = CONSTANTS[materialRev];

    if (isNaN(r) || isNaN(tBaseVal) || isNaN(tTargetVal)) return null;

    // Formula: R_target = R_std * ( (T_target + k) / (T_std + k) )
    const rTarget = r * ((tTargetVal + k) / (tBaseVal + k));
    return rTarget;
  }, [rBase, tBase, tTarget, materialRev]);

  const handleReset = () => {
    setRHot('');
    setTHot('');
  };

  const handleResetRev = () => {
    setRBase('');
    setTTarget('');
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12 animate-fade-in">
      <div className="flex items-center gap-3 mb-2">
        <div className="p-3 bg-brand-50 rounded-lg text-brand-600">
          <Calculator size={24} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-800">工程計算工具箱 (Utilities)</h2>
          <p className="text-sm text-slate-500">導體溫度補償與電阻預測換算</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Tool Card 1: Temperature Compensation (Hot -> Std) */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full hover:shadow-md transition-shadow">
          <div className="bg-slate-50 border-b border-slate-100 p-4 flex justify-between items-center">
            <div className="flex items-center gap-2 font-bold text-slate-700">
              <Thermometer size={18} className="text-brand-600" />
              溫度補償校正 (回推標準值)
            </div>
            <div className="text-xs bg-brand-100 text-brand-700 px-2 py-0.5 rounded font-bold">
              測量 → 標準
            </div>
          </div>

          <div className="p-6 space-y-6 flex-1 flex flex-col">
            {/* Material Selector */}
            <div className="flex bg-slate-100 p-1 rounded-lg w-fit">
              <button
                onClick={() => setMaterial('copper')}
                className={`px-4 py-1.5 text-sm font-bold rounded-md transition-all ${material === 'copper' ? 'bg-white text-orange-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                銅 (Copper)
              </button>
              <button
                onClick={() => setMaterial('aluminum')}
                className={`px-4 py-1.5 text-sm font-bold rounded-md transition-all ${material === 'aluminum' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                鋁 (Aluminum)
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">
                  高溫測得電阻 (<span className="font-serif italic">R<sub>hot</sub></span>)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={rHot}
                    onChange={(e) => setRHot(e.target.value)}
                    className="w-full pl-3 pr-8 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-brand-500 outline-none font-mono"
                    placeholder="0.00"
                  />
                  <span className="absolute right-3 top-2 text-slate-400 text-sm">Ω</span>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">
                  測量時溫度 (<span className="font-serif italic">T<sub>hot</sub></span>)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={tHot}
                    onChange={(e) => setTHot(e.target.value)}
                    className="w-full pl-3 pr-8 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-brand-500 outline-none font-mono"
                    placeholder="例如: 75"
                  />
                  <span className="absolute right-3 top-2 text-slate-400 text-sm">°C</span>
                </div>
              </div>
            </div>

            {/* Divider with Arrow */}
            <div className="relative h-4 flex items-center justify-center">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200"></div>
              </div>
              <div className="relative bg-white px-2 text-slate-400">
                <ArrowRight size={16} />
              </div>
            </div>

            {/* Result Section */}
            <div className="bg-slate-900 rounded-lg p-4 text-white relative overflow-hidden shadow-inner">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <Zap size={64} />
              </div>
              <div className="flex justify-between items-end relative z-10">
                <div>
                  <div className="text-xs text-slate-400 mb-1 flex items-center gap-1">
                    換算後標準電阻 (<span className="font-serif italic">R<sub>std</sub></span>) @
                    <input
                      type="number"
                      value={tStd}
                      onChange={(e) => setTStd(e.target.value)}
                      className="w-8 bg-slate-800 border border-slate-700 rounded text-center text-xs text-white ml-1 focus:ring-1 focus:ring-brand-500 outline-none"
                    />
                    °C
                  </div>
                  <div className="text-3xl font-mono font-bold text-brand-400 tracking-tight">
                    {result !== null ? result.toFixed(5) : '---'}
                    <span className="text-sm text-slate-500 ml-2 font-sans">Ω</span>
                  </div>
                </div>
                <button
                  onClick={handleReset}
                  className="p-2 bg-slate-800 hover:bg-slate-700 rounded-full text-slate-400 hover:text-white transition-colors border border-slate-700"
                  title="重置"
                >
                  <RotateCcw size={16} />
                </button>
              </div>
            </div>

            {/* Formula Explanation */}
            <div className="mt-auto bg-slate-50 p-3 rounded text-xs text-slate-500 space-y-2 border border-slate-100">
              <p className="font-bold flex items-center gap-1 text-slate-600">
                <span className="w-1 h-3 bg-brand-500 rounded-full"></span>
                公式原理 (推論絕對溫度):
              </p>
              <div className="font-mono bg-white p-2 rounded border border-slate-200 text-center text-slate-700 my-2 shadow-sm text-[11px] sm:text-xs">
                R<sub>std</sub> = R<sub>hot</sub> ×
                <span className="inline-block mx-1 align-middle text-center leading-tight">
                  <span className="block border-b border-slate-300 pb-0.5">{tStd} + {CONSTANTS[material]}</span>
                  <span className="block pt-0.5">T<sub>hot</sub> + {CONSTANTS[material]}</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Tool Card 2: Resistance Prediction (Std -> Target) */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full hover:shadow-md transition-shadow">
          <div className="bg-red-50 border-b border-red-100 p-4 flex justify-between items-center">
            <div className="flex items-center gap-2 font-bold text-slate-700">
              <Flame size={18} className="text-red-500" />
              高溫電阻預測 (環境變化模擬)
            </div>
            <div className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded font-bold">
              標準 → 高溫
            </div>
          </div>

          <div className="p-6 space-y-6 flex-1 flex flex-col">
            {/* Material Selector */}
            <div className="flex bg-slate-100 p-1 rounded-lg w-fit">
              <button
                onClick={() => setMaterialRev('copper')}
                className={`px-4 py-1.5 text-sm font-bold rounded-md transition-all ${materialRev === 'copper' ? 'bg-white text-red-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                銅 (Copper)
              </button>
              <button
                onClick={() => setMaterialRev('aluminum')}
                className={`px-4 py-1.5 text-sm font-bold rounded-md transition-all ${materialRev === 'aluminum' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                鋁 (Aluminum)
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">
                  標準/初始電阻 (<span className="font-serif italic">R<sub>std</sub></span>)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={rBase}
                    onChange={(e) => setRBase(e.target.value)}
                    className="w-full pl-3 pr-8 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-red-500 outline-none font-mono"
                    placeholder="0.00"
                  />
                  <span className="absolute right-3 top-2 text-slate-400 text-sm">Ω</span>
                </div>
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-xs font-bold text-slate-500 mb-1">
                    標準溫度
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={tBase}
                      onChange={(e) => setTBase(e.target.value)}
                      className="w-full px-2 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-red-500 outline-none font-mono text-center text-sm"
                    />
                  </div>
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-bold text-red-600 mb-1">
                    預估高溫
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={tTarget}
                      onChange={(e) => setTTarget(e.target.value)}
                      className="w-full px-2 py-2 border border-red-300 bg-red-50 rounded-md focus:ring-2 focus:ring-red-500 outline-none font-mono text-center text-sm font-bold text-red-800"
                      placeholder="例如: 75"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Divider with Arrow */}
            <div className="relative h-4 flex items-center justify-center">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200"></div>
              </div>
              <div className="relative bg-white px-2 text-slate-400">
                <ArrowRight size={16} />
              </div>
            </div>

            {/* Result Section */}
            <div className="bg-red-950 rounded-lg p-4 text-white relative overflow-hidden shadow-inner">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <TrendingUp size={64} />
              </div>
              <div className="flex justify-between items-end relative z-10">
                <div>
                  <div className="text-xs text-red-200 mb-1 flex items-center gap-1">
                    預估高溫測得電阻 (<span className="font-serif italic">R<sub>hot</sub></span>)
                  </div>
                  <div className="text-3xl font-mono font-bold text-red-400 tracking-tight">
                    {resultRev !== null ? resultRev.toFixed(5) : '---'}
                    <span className="text-sm text-slate-400 ml-2 font-sans">Ω</span>
                  </div>
                </div>
                <button
                  onClick={handleResetRev}
                  className="p-2 bg-red-900 hover:bg-red-800 rounded-full text-red-300 hover:text-white transition-colors border border-red-800"
                  title="重置"
                >
                  <RotateCcw size={16} />
                </button>
              </div>
            </div>

            {/* Formula Explanation */}
            <div className="mt-auto bg-slate-50 p-3 rounded text-xs text-slate-500 space-y-2 border border-slate-100">
              <p className="font-bold flex items-center gap-1 text-slate-600">
                <span className="w-1 h-3 bg-red-500 rounded-full"></span>
                公式原理 (溫度係數預估):
              </p>
              <div className="font-mono bg-white p-2 rounded border border-slate-200 text-center text-slate-700 my-2 shadow-sm text-[11px] sm:text-xs">
                R<sub>hot</sub> = R<sub>std</sub> ×
                <span className="inline-block mx-1 align-middle text-center leading-tight">
                  <span className="block border-b border-slate-300 pb-0.5">T<sub>hot</sub> + {CONSTANTS[materialRev]}</span>
                  <span className="block pt-0.5">{tBase} + {CONSTANTS[materialRev]}</span>
                </span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
