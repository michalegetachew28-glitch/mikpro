import React, { useState, useEffect, useRef } from 'react';
import './PhoneInput.css';

const COUNTRY_CODES = [
  { code: '+251', label: '🇪🇹 +251 (ET)', flag: '🇪🇹' }
];

const PhoneInput = ({ value, onChange, placeholder = "9XXXXXXXX or 7XXXXXXXX", required = false }) => {
  const [countryCode, setCountryCode] = useState('+251');
  const [localNumber, setLocalNumber] = useState('');
  const [touched, setTouched] = useState(false);
  const isTypingRef = useRef(false);

  // Parse incoming value (format: [code][number])
  useEffect(() => {
    if (isTypingRef.current) return; 
    
    if (value === undefined || value === null || value === '') {
      setLocalNumber('');
      return;
    }
    
    // Normalize format
    let cleanVal = value.toString().replace(/\D/g, '');
    if (cleanVal.startsWith('251')) {
      setLocalNumber(cleanVal.substring(3));
    } else if (cleanVal.startsWith('0')) {
      setLocalNumber(cleanVal.substring(1));
    } else {
      setLocalNumber(cleanVal);
    }
  }, [value]);


  const validate = (num) => {
    const cleanNum = num.replace(/\D/g, '');
    if (!required && cleanNum.length === 0) return true;
    
    // Ethiopia specific: Must start with 7 or 9 and have 9 digits
    return (cleanNum.startsWith('9') || cleanNum.startsWith('7')) && cleanNum.length === 9;
  };

  const handleNumberChange = (e) => {
    let inputVal = e.target.value.replace(/\D/g, '');
    
    // If user starts with '0', remove it (we handle prefix via code)
    if (inputVal.startsWith('0')) inputVal = inputVal.substring(1);

    // Enforce '7' or '9' start
    if (inputVal.length === 1 && (inputVal !== '9' && inputVal !== '7')) {
      return;
    }
    
    const newNum = inputVal.substring(0, 9);
    setLocalNumber(newNum);
    setTouched(true);
    isTypingRef.current = true;
    triggerChange(newNum);
    setTimeout(() => { isTypingRef.current = false; }, 0);
  };

  const triggerChange = (num) => {
    const isValid = validate(num);
    // Always export as 251XXXXXXXXX format for database consistency
    const fullNumber = num ? `251${num}` : '';
    
    if (onChange) {
      onChange(fullNumber, isValid);
    }
  };

  const isValid = validate(localNumber);
  const showError = touched && !isValid && (required || localNumber.length > 0);

  return (
    <div className="phone-wrapper">
      <div className={`custom-phone-input-group ${showError ? 'input-error' : ''}`}>
        <div className="phone-prefix-static">
          <span>🇪🇹 +251</span>
        </div>
        <input
          type="tel"
          className="phone-local-input"
          value={localNumber}
          onChange={handleNumberChange}
          onBlur={() => setTouched(true)}
          placeholder={placeholder}
          required={required}
          maxLength={9}
        />
      </div>
      {showError && (
        <span className="phone-error-msg">
          Must be 9 digits starting with 7 or 9 (e.g. 911223344)
        </span>
      )}
    </div>
  );
};

export default PhoneInput;
