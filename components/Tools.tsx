
import React, { useState, useMemo } from 'react';
import { Calculator, ArrowRight, RotateCcw, Thermometer, Zap } from 'lucide-react';

export const Tools: React.FC = () => {
  // --- State for Temp Resistance Calculator ---
  const [material, setMaterial] = useState<'copper' | 'aluminum'>('copper');
  const [rHot, setRHot] = useState<string>(''); // Measured Resistance
  const [tHot, setTHot] = useState<string>(''); // Measured Temp
  const [tStd, setTStd] = useState<string>('20'); // Standard Temp (Target)

  // Constants
  const CONSTANTS = {
    copper: 234.5,
    aluminum: 228
  };

  // Calculation Logic
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

  const handleReset = () => {
    setRHot('');
    setTHot('');
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      <div className="flex items-center gap-3 mb-2">
        <div className="p-3 bg-brand-50 rounded-lg text-brand-600">
          <Calculator size={24} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-800">實用工具箱 (Utilities)</h2>
          <p className="text-sm text-slate-500">工程師常用計算工具與輔助程式</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Tool Card 1: Temperature Compensation */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-slate-50 border-b border-slate-100 p-4 flex justify-between items-center">
            <div className="flex items-center gap-2 font-bold text-slate-700">
              <Thermometer size={18} className="text-brand-600" />
              導體溫度補償 (推論絕對溫度)
            </div>
            <div className="text-xs bg-brand-100 text-brand-700 px-2 py-0.5 rounded font-bold">
              電阻換算
            </div>
          </div>

          <div className="p-6 space-y-6">
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
            <div className="bg-slate-900 rounded-lg p-4 text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <Zap size={64} />
              </div>
              <div className="flex justify-between items-end relative z-10">
                <div>
                  <div className="text-xs text-slate-400 mb-1 flex items-center gap-1">
                    換算後標準電阻 (<span className="font-serif italic">R<sub>{tStd}</sub></span>)
                    <input
                      type="number"
                      value={tStd}
                      onChange={(e) => setTStd(e.target.value)}
                      className="w-8 bg-slate-800 border border-slate-700 rounded text-center text-xs text-white ml-1 focus:ring-1 focus:ring-brand-500 outline-none"
                    />
                    °C
                  </div>
                  <div className="text-3xl font-mono font-bold text-brand-400">
                    {result !== null ? result.toFixed(5) : '---'}
                    <span className="text-sm text-slate-500 ml-2">Ω</span>
                  </div>
                </div>
                <button
                  onClick={handleReset}
                  className="p-2 bg-slate-800 hover:bg-slate-700 rounded-full text-slate-400 hover:text-white transition-colors"
                  title="重置"
                >
                  <RotateCcw size={16} />
                </button>
              </div>
            </div>

            {/* Formula Explanation */}
            <div className="bg-slate-50 p-3 rounded text-xs text-slate-500 space-y-2 border border-slate-100">
              <p className="font-bold flex items-center gap-1">
                <span className="w-1 h-3 bg-brand-500 rounded-full"></span>
                公式原理 (推論絕對溫度):
              </p>
              <div className="font-mono bg-white p-2 rounded border border-slate-200 text-center text-slate-700 my-2">
                R<sub>{tStd}</sub> = R<sub>hot</sub> ×
                <span className="inline-block mx-1 align-middle text-center">
                  <span className="block border-b border-slate-400 pb-0.5">{tStd} + {CONSTANTS[material]}</span>
                  <span className="block pt-0.5">T<sub>hot</sub> + {CONSTANTS[material]}</span>
                </span>
              </div>
              <ul className="list-disc list-inside space-y-1 ml-1 text-[10px]">
                <li>{material === 'copper' ? '銅 (Copper)' : '鋁 (Aluminum)'} 的推論絕對零度常數為 <b>{CONSTANTS[material]}</b>。</li>
                <li>此公式常用於馬達、變壓器繞組測試，無需查表。</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Placeholder for future tools */}
        <div className="border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center p-8 text-slate-400 min-h-[300px]">
          <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
            <Plus size={32} className="text-slate-300" />
          </div>
          <h3 className="font-bold">更多工具開發中...</h3>
          <p className="text-sm mt-1">未來可加入 單位換算、誤差分析 等功能</p>
        </div>

      </div>
    </div>
  );
};

// Lucide icon import helper for the placeholder
import { Plus } from 'lucide-react';
