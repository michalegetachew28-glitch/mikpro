import React, { useState, useEffect, useCallback } from 'react';
import { toEthiopian, toGregorian, getDaysInMonth, ETHIOPIAN_MONTHS } from '../utils/ethiopianDate';

const EthiopianSelector = ({ value, onChange, label, size = 'large', language = 'en' }) => {
  // Helper to parse "YYYY-MM-DD" as local date to avoid UTC shift
  const parseLocalISO = useCallback((s) => {
    if (!s) return new Date();
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
  }, []);

  // Isolated internal state to prevent "fighting" between parent and child during selection
  const [localEC, setLocalEC] = useState(() => toEthiopian(parseLocalISO(value)));

  // Sync local state ONLY when external value changes (e.g. filter cleared)
  useEffect(() => {
    const synched = toEthiopian(parseLocalISO(value));
    if (synched.year !== localEC.year || synched.month !== localEC.month || synched.day !== localEC.day) {
      setLocalEC(synched);
    }
  }, [value, parseLocalISO, localEC.year, localEC.month, localEC.day]);

  const handleECChange = (field, newVal) => {
    const nextEC = {
      day: field === 'day' ? parseInt(newVal) : localEC.day,
      month: field === 'month' ? parseInt(newVal) : localEC.month,
      year: field === 'year' ? parseInt(newVal) : localEC.year
    };
    
    // Defensive adjustment: prevent invalid days (like Pagume 6 on non-leap years)
    const maxDays = getDaysInMonth(nextEC.year, nextEC.month);
    if (nextEC.day > maxDays) nextEC.day = maxDays;

    // Update local state immediately for a smooth UI feel
    setLocalEC(nextEC);

    const greg = toGregorian(nextEC.year, nextEC.month, nextEC.day);
    const y = greg.getFullYear();
    const m = String(greg.getMonth() + 1).padStart(2, '0');
    const d = String(greg.getDate()).padStart(2, '0');
    onChange(`${y}-${m}-${d}`);
  };

  return (
    <div className="ethiopian-datepicker">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <label>{label}</label>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '0.7fr 1.4fr 0.9fr', gap: 3, maxWidth: '240px' }}>
        <select 
          className="auth-input" 
          style={{ padding: '0 6px', height: size === 'large' ? '38px' : '32px', fontSize: '0.85rem', fontWeight: 600 }}
          value={localEC.day}
          onChange={(e) => handleECChange('day', e.target.value)}
        >
          {[...Array(getDaysInMonth(localEC.year, localEC.month)).keys()].map(i => (
            <option key={i+1} value={i+1}>{i+1}</option>
          ))}
        </select>
        <select 
          className="auth-input" 
          style={{ padding: '0 6px', height: size === 'large' ? '38px' : '32px', fontSize: '0.85rem', fontWeight: 600 }}
          value={localEC.month}
          onChange={(e) => handleECChange('month', e.target.value)}
        >
          {ETHIOPIAN_MONTHS.map((m, i) => (
            <option key={i+1} value={i+1}>{m[language] || m.en || m.am}</option>
          ))}
        </select>
        <input 
          type="number"
          className="auth-input" 
          style={{ padding: '0 6px', height: size === 'large' ? '38px' : '32px', fontSize: '0.85rem', fontWeight: 600 }}
          value={localEC.year}
          onChange={(e) => handleECChange('year', e.target.value)}
        />
      </div>
    </div>
  );
};

export default EthiopianSelector;
