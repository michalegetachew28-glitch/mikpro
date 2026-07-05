import React from 'react';

/**
 * LoadingButton – drop-in replacement for <button> with built-in loading state.
 *
 * Props:
 *  - isLoading  : boolean        – shows spinner, disables button
 *  - loadingText: string         – text to show while loading (default: children)
 *  - disabled   : boolean        – additional disabled condition
 *  - className  : string         – CSS class (e.g. "btn-primary")
 *  - children   : ReactNode      – button label / content
 *  - ...rest    : any            – all other <button> props (onClick, type, style…)
 */
const LoadingButton = ({
  isLoading = false,
  loadingText,
  disabled = false,
  className = 'btn-primary',
  children,
  style = {},
  ...rest
}) => {
  const isDisabled = isLoading || disabled;

  return (
    <button
      {...rest}
      className={className}
      disabled={isDisabled}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        position: 'relative',
        opacity: isDisabled && !isLoading ? 0.6 : 1,
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        transition: 'opacity 0.2s',
        ...style,
      }}
      aria-busy={isLoading}
    >
      {isLoading && <ButtonSpinner />}
      {isLoading ? (loadingText ?? children) : children}
    </button>
  );
};

/* Inline button spinner */
const ButtonSpinner = () => (
  <span
    aria-hidden="true"
    style={{
      width: 16,
      height: 16,
      borderRadius: '50%',
      border: '2px solid rgba(255,255,255,0.35)',
      borderTopColor: '#fff',
      flexShrink: 0,
      animation: 'btn-spin 0.7s linear infinite',
      display: 'inline-block',
    }}
  />
);

/* Inject @keyframes once (without a separate CSS file) */
if (typeof document !== 'undefined') {
  const STYLE_ID = 'loading-button-keyframes';
  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `@keyframes btn-spin { to { transform: rotate(360deg); } }`;
    document.head.appendChild(style);
  }
}

export default LoadingButton;
