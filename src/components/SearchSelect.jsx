import React, { useState, useEffect, useRef } from 'react';
import { Search, X, ChevronDown } from 'lucide-react';

const SearchSelect = ({
  options = [],
  value = '',
  onChange,
  placeholder = 'Search...',
  labelKey = 'name',
  valueKey = 'id',
  onSearchChange,
  loading = false,
  disabled = false,
  renderOption,
  emptyMessage = 'No results found'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Sync searchTerm with selected option name on value change
  const selectedOption = options.find((opt) => String(opt[valueKey]) === String(value));
  useEffect(() => {
    if (selectedOption) {
      setSearchTerm(selectedOption[labelKey] || '');
    } else {
      setSearchTerm('');
    }
  }, [value, selectedOption, labelKey]);

  // Handle option selection
  const handleSelect = (option) => {
    onChange(option[valueKey], option);
    setSearchTerm(option[labelKey] || '');
    setIsOpen(false);
    setFocusedIndex(-1);
  };

  // Clear selection
  const handleClear = (e) => {
    e.stopPropagation();
    onChange('', null);
    setSearchTerm('');
    setIsOpen(false);
    setFocusedIndex(-1);
    if (onSearchChange) onSearchChange('');
  };

  // Keyboard navigation
  const handleKeyDown = (e) => {
    if (disabled) return;

    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsOpen(true);
      }
      return;
    }

    const filtered = options;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setFocusedIndex((prev) => (prev < filtered.length - 1 ? prev + 1 : prev));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusedIndex((prev) => (prev > 0 ? prev - 1 : prev));
        break;
      case 'Enter':
        e.preventDefault();
        if (focusedIndex >= 0 && focusedIndex < filtered.length) {
          handleSelect(filtered[focusedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        setFocusedIndex(-1);
        break;
      case 'Tab':
        setIsOpen(false);
        setFocusedIndex(-1);
        break;
      default:
        break;
    }
  };

  const handleInputChange = (e) => {
    const term = e.target.value;
    setSearchTerm(term);
    setIsOpen(true);
    if (onSearchChange) {
      onSearchChange(term);
    }
  };

  return (
    <div 
      className={`search-select-container ${disabled ? 'disabled' : ''}`} 
      ref={containerRef}
      style={{ position: 'relative', width: '100%' }}
    >
      <div 
        className="search-select-input-wrapper"
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          width: '100%'
        }}
      >
        <Search 
          size={16} 
          style={{
            position: 'absolute',
            left: '12px',
            opacity: 0.4,
            pointerEvents: 'none'
          }} 
        />
        <input
          ref={inputRef}
          type="text"
          value={searchTerm}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          disabled={disabled}
          style={{
            width: '100%',
            padding: '12px 36px 12px 36px',
            borderRadius: '12px',
            border: '1px solid var(--border)',
            background: 'var(--bg-main)',
            color: 'var(--text-primary)',
            fontSize: '0.9rem',
            outline: 'none',
            transition: 'border-color 0.2s',
            ...(isOpen && { borderColor: 'var(--primary)' })
          }}
        />

        {searchTerm && (
          <button
            type="button"
            onClick={handleClear}
            style={{
              position: 'absolute',
              right: '32px',
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: 0.4
            }}
          >
            <X size={16} />
          </button>
        )}

        <ChevronDown 
          size={16} 
          style={{
            position: 'absolute',
            right: '12px',
            opacity: 0.4,
            pointerEvents: 'none',
            transform: isOpen ? 'rotate(180deg)' : 'none',
            transition: 'transform 0.2s'
          }} 
        />
      </div>

      {isOpen && (
        <div 
          className="search-select-dropdown"
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            marginTop: '8px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
            zIndex: 9999,
            maxHeight: '220px',
            overflowY: 'auto'
          }}
        >
          {loading ? (
            <div style={{ padding: '12px', textAlign: 'center', opacity: 0.5, fontSize: '0.85rem' }}>
              Loading...
            </div>
          ) : options.length === 0 ? (
            <div style={{ padding: '12px', textAlign: 'center', opacity: 0.5, fontSize: '0.85rem' }}>
              {emptyMessage}
            </div>
          ) : (
            options.map((option, idx) => {
              const isFocused = idx === focusedIndex;
              const isSelected = String(option[valueKey]) === String(value);

              return (
                <div
                  key={option[valueKey] || idx}
                  className={`search-select-option ${isFocused ? 'focused' : ''} ${isSelected ? 'selected' : ''}`}
                  onClick={() => handleSelect(option)}
                  onMouseEnter={() => setFocusedIndex(idx)}
                  style={{
                    padding: '10px 14px',
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                    transition: 'all 0.15s ease',
                    background: isSelected 
                      ? 'rgba(67, 97, 238, 0.1)' 
                      : isFocused 
                        ? 'rgba(67, 97, 238, 0.05)' 
                        : 'transparent',
                    color: isSelected ? 'var(--primary)' : 'var(--text-primary)',
                    fontWeight: isSelected ? '600' : 'normal',
                    borderBottom: '1px solid rgba(0, 0, 0, 0.02)'
                  }}
                >
                  {renderOption ? renderOption(option) : option[labelKey]}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

export default SearchSelect;
