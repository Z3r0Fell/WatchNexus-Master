/**
 * Juice - WatchNexus Color Picker Module
 * 🧃 Fresh, vibrant color selection
 * 
 * A comprehensive color picker component for the Theme Forge.
 * Features:
 * - Color spectrum picker
 * - Hue/Saturation/Brightness sliders
 * - RGB/HSL/HEX input
 * - Preset color palettes
 * - Color history
 * - Accessibility contrast checking
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Pipette, Copy, Check, RefreshCw, History, Palette } from 'lucide-react';

// Color conversion utilities
const hexToRgb = (hex) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  } : { r: 0, g: 0, b: 0 };
};

const rgbToHex = (r, g, b) => {
  return '#' + [r, g, b].map(x => {
    const hex = Math.round(x).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
};

const rgbToHsl = (r, g, b) => {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;

  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
      default: h = 0;
    }
  }

  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
};

const hslToRgb = (h, s, l) => {
  h /= 360; s /= 100; l /= 100;
  let r, g, b;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }

  return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
};

// Calculate contrast ratio for accessibility
const getContrastRatio = (color1, color2) => {
  const getLuminance = (r, g, b) => {
    const [rs, gs, bs] = [r, g, b].map(c => {
      c /= 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
  };

  const rgb1 = hexToRgb(color1);
  const rgb2 = hexToRgb(color2);
  const l1 = getLuminance(rgb1.r, rgb1.g, rgb1.b);
  const l2 = getLuminance(rgb2.r, rgb2.g, rgb2.b);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return ((lighter + 0.05) / (darker + 0.05)).toFixed(2);
};

// Color spectrum canvas
const ColorSpectrum = ({ hue, saturation, lightness, onChange }) => {
  const canvasRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // Draw saturation/lightness gradient
    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        const s = (x / width) * 100;
        const l = 100 - (y / height) * 100;
        const rgb = hslToRgb(hue, s, l);
        ctx.fillStyle = rgbToHex(rgb.r, rgb.g, rgb.b);
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }, [hue]);

  const handleMouseDown = useCallback((e) => {
    setIsDragging(true);
    handleMove(e);
  }, []);

  const handleMove = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = Math.max(0, Math.min(canvas.width, e.clientX - rect.left));
    const y = Math.max(0, Math.min(canvas.height, e.clientY - rect.top));

    const s = Math.round((x / canvas.width) * 100);
    const l = Math.round(100 - (y / canvas.height) * 100);

    onChange({ s, l });
  }, [onChange]);

  const handleMouseMove = useCallback((e) => {
    if (isDragging) handleMove(e);
  }, [isDragging, handleMove]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  // Calculate cursor position
  const cursorX = (saturation / 100) * 200;
  const cursorY = ((100 - lightness) / 100) * 150;

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        width={200}
        height={150}
        className="rounded-lg cursor-crosshair border border-white/10"
        onMouseDown={handleMouseDown}
      />
      <div
        className="absolute w-4 h-4 border-2 border-white rounded-full shadow-lg pointer-events-none -translate-x-1/2 -translate-y-1/2"
        style={{ left: cursorX, top: cursorY }}
      />
    </div>
  );
};

// Hue slider
const HueSlider = ({ hue, onChange }) => {
  return (
    <div className="relative h-4 rounded-full overflow-hidden"
      style={{
        background: 'linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)'
      }}
    >
      <input
        type="range"
        min={0}
        max={360}
        value={hue}
        onChange={(e) => onChange(parseInt(e.target.value))}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
      />
      <div
        className="absolute top-0 w-3 h-4 bg-white rounded-sm shadow-md border border-gray-300 -translate-x-1/2 pointer-events-none"
        style={{ left: `${(hue / 360) * 100}%` }}
      />
    </div>
  );
};

// Alpha/opacity slider
const AlphaSlider = ({ alpha, color, onChange }) => {
  return (
    <div className="relative h-4 rounded-full overflow-hidden"
      style={{
        background: `linear-gradient(to right, transparent, ${color})`,
        backgroundImage: `
          linear-gradient(to right, transparent, ${color}),
          linear-gradient(45deg, #ccc 25%, transparent 25%),
          linear-gradient(-45deg, #ccc 25%, transparent 25%),
          linear-gradient(45deg, transparent 75%, #ccc 75%),
          linear-gradient(-45deg, transparent 75%, #ccc 75%)
        `,
        backgroundSize: '100% 100%, 8px 8px, 8px 8px, 8px 8px, 8px 8px',
        backgroundPosition: '0 0, 0 0, 4px 0, 4px -4px, 0 4px'
      }}
    >
      <input
        type="range"
        min={0}
        max={100}
        value={alpha}
        onChange={(e) => onChange(parseInt(e.target.value))}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
      />
      <div
        className="absolute top-0 w-3 h-4 bg-white rounded-sm shadow-md border border-gray-300 -translate-x-1/2 pointer-events-none"
        style={{ left: `${alpha}%` }}
      />
    </div>
  );
};

// Main Juice Color Picker Component
export const JuiceColorPicker = ({
  color = '#8B5CF6',
  onChange,
  showAlpha = false,
  showPresets = true,
  presets = [],
  label = 'Color',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState(color);
  const [colorHistory, setColorHistory] = useState([]);
  const [copied, setCopied] = useState(false);
  
  // Parse color to HSL
  const rgb = hexToRgb(color);
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
  const [hue, setHue] = useState(hsl.h);
  const [saturation, setSaturation] = useState(hsl.s);
  const [lightness, setLightness] = useState(hsl.l);
  const [alpha, setAlpha] = useState(100);

  // Update color when HSL changes
  useEffect(() => {
    const newRgb = hslToRgb(hue, saturation, lightness);
    const newHex = rgbToHex(newRgb.r, newRgb.g, newRgb.b);
    setInputValue(newHex);
    onChange?.(newHex);
  }, [hue, saturation, lightness]);

  // Handle input change
  const handleInputChange = (value) => {
    setInputValue(value);
    if (/^#[0-9A-F]{6}$/i.test(value)) {
      const newRgb = hexToRgb(value);
      const newHsl = rgbToHsl(newRgb.r, newRgb.g, newRgb.b);
      setHue(newHsl.h);
      setSaturation(newHsl.s);
      setLightness(newHsl.l);
      onChange?.(value);
    }
  };

  // Copy to clipboard
  const copyToClipboard = () => {
    navigator.clipboard.writeText(inputValue);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Add to history
  const addToHistory = () => {
    if (!colorHistory.includes(inputValue)) {
      setColorHistory(prev => [inputValue, ...prev.slice(0, 7)]);
    }
  };

  // Default presets
  const defaultPresets = [
    '#EF4444', '#F97316', '#FBBF24', '#22C55E',
    '#14B8A6', '#3B82F6', '#8B5CF6', '#EC4899',
    '#F43F5E', '#6366F1', '#0EA5E9', '#10B981',
  ];

  const allPresets = presets.length > 0 ? presets : defaultPresets;

  return (
    <div className="relative">
      {/* Color preview button */}
      <div className="flex items-center gap-2">
        {label && <span className="text-sm text-gray-400">{label}</span>}
        <button
          onClick={() => {
            setIsOpen(!isOpen);
            if (isOpen) addToHistory();
          }}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 hover:border-white/20 transition-all"
        >
          <div
            className="w-6 h-6 rounded-md shadow-inner"
            style={{ backgroundColor: inputValue }}
          />
          <span className="font-mono text-sm">{inputValue}</span>
          <Pipette className="w-4 h-4 text-gray-400" />
        </button>
      </div>

      {/* Picker dropdown */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute z-50 top-full left-0 mt-2 p-4 rounded-xl bg-gray-900 border border-white/10 shadow-2xl min-w-[280px]"
          >
            {/* Color spectrum */}
            <ColorSpectrum
              hue={hue}
              saturation={saturation}
              lightness={lightness}
              onChange={({ s, l }) => {
                setSaturation(s);
                setLightness(l);
              }}
            />

            {/* Hue slider */}
            <div className="mt-4">
              <label className="text-xs text-gray-500 mb-1 block">Hue</label>
              <HueSlider hue={hue} onChange={setHue} />
            </div>

            {/* Alpha slider (optional) */}
            {showAlpha && (
              <div className="mt-3">
                <label className="text-xs text-gray-500 mb-1 block">Opacity</label>
                <AlphaSlider alpha={alpha} color={inputValue} onChange={setAlpha} />
              </div>
            )}

            {/* Input fields */}
            <div className="mt-4 flex gap-2">
              <div className="flex-1">
                <label className="text-xs text-gray-500 mb-1 block">HEX</label>
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => handleInputChange(e.target.value)}
                  className="w-full px-2 py-1.5 rounded bg-white/5 border border-white/10 text-sm font-mono"
                />
              </div>
              <div className="flex items-end gap-1">
                <button
                  onClick={copyToClipboard}
                  className="p-1.5 rounded bg-white/5 hover:bg-white/10 transition-colors"
                  title="Copy"
                >
                  {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* RGB values */}
            <div className="mt-3 grid grid-cols-3 gap-2">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">R</label>
                <input
                  type="number"
                  min={0}
                  max={255}
                  value={rgb.r}
                  onChange={(e) => {
                    const newHex = rgbToHex(parseInt(e.target.value) || 0, rgb.g, rgb.b);
                    handleInputChange(newHex);
                  }}
                  className="w-full px-2 py-1 rounded bg-white/5 border border-white/10 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">G</label>
                <input
                  type="number"
                  min={0}
                  max={255}
                  value={rgb.g}
                  onChange={(e) => {
                    const newHex = rgbToHex(rgb.r, parseInt(e.target.value) || 0, rgb.b);
                    handleInputChange(newHex);
                  }}
                  className="w-full px-2 py-1 rounded bg-white/5 border border-white/10 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">B</label>
                <input
                  type="number"
                  min={0}
                  max={255}
                  value={rgb.b}
                  onChange={(e) => {
                    const newHex = rgbToHex(rgb.r, rgb.g, parseInt(e.target.value) || 0);
                    handleInputChange(newHex);
                  }}
                  className="w-full px-2 py-1 rounded bg-white/5 border border-white/10 text-sm"
                />
              </div>
            </div>

            {/* Presets */}
            {showPresets && (
              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs text-gray-500 flex items-center gap-1">
                    <Palette className="w-3 h-3" /> Presets
                  </label>
                </div>
                <div className="grid grid-cols-6 gap-1.5">
                  {allPresets.map((preset) => (
                    <button
                      key={preset}
                      onClick={() => handleInputChange(preset)}
                      className={`w-7 h-7 rounded-md shadow-sm transition-transform hover:scale-110 ${
                        inputValue.toLowerCase() === preset.toLowerCase()
                          ? 'ring-2 ring-white ring-offset-2 ring-offset-gray-900'
                          : ''
                      }`}
                      style={{ backgroundColor: preset }}
                      title={preset}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Color history */}
            {colorHistory.length > 0 && (
              <div className="mt-4">
                <label className="text-xs text-gray-500 flex items-center gap-1 mb-2">
                  <History className="w-3 h-3" /> Recent
                </label>
                <div className="flex gap-1.5">
                  {colorHistory.map((histColor, i) => (
                    <button
                      key={i}
                      onClick={() => handleInputChange(histColor)}
                      className="w-6 h-6 rounded-md shadow-sm transition-transform hover:scale-110"
                      style={{ backgroundColor: histColor }}
                      title={histColor}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Contrast checker */}
            <div className="mt-4 p-2 rounded-lg bg-white/5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500">Contrast (vs white)</span>
                <span className={`font-mono ${
                  parseFloat(getContrastRatio(inputValue, '#FFFFFF')) >= 4.5
                    ? 'text-green-400'
                    : parseFloat(getContrastRatio(inputValue, '#FFFFFF')) >= 3
                    ? 'text-yellow-400'
                    : 'text-red-400'
                }`}>
                  {getContrastRatio(inputValue, '#FFFFFF')}:1
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Quick color input (simplified version)
export const JuiceColorInput = ({ color, onChange, label }) => {
  return (
    <div className="flex items-center gap-2">
      {label && <span className="text-sm text-gray-400 w-24">{label}</span>}
      <div className="flex items-center gap-2 flex-1">
        <input
          type="color"
          value={color}
          onChange={(e) => onChange(e.target.value)}
          className="w-10 h-10 rounded-lg cursor-pointer border-0 bg-transparent"
        />
        <input
          type="text"
          value={color}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm font-mono"
        />
      </div>
    </div>
  );
};

export default JuiceColorPicker;
