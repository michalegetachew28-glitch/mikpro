import React from 'react';
import { useAppContext } from '../context/AppContext';
import { ShieldAlert, X, Check } from 'lucide-react';
import './GlobalConfirmationBar.css';

const GlobalConfirmationBar = () => {
    const { confirmingAction, setConfirmingAction, t } = useAppContext();

    if (!confirmingAction) return null;

    const handleConfirm = () => {
        if (confirmingAction.onConfirm) {
            confirmingAction.onConfirm();
        }
        setConfirmingAction(null);
    };

    const handleCancel = () => {
        setConfirmingAction(null);
    };

    return (
        <div className="global-confirm-bar">
            <div className="confirm-container">
                <div className="confirm-main">
                    <div className="warning-pulse">
                        <ShieldAlert size={24} />
                    </div>
                    <div className="confirm-body">
                        <h4>{t('areYouSure') || 'Verification Required'}</h4>
                        <p>{confirmingAction.label}</p>
                    </div>
                </div>
                <div className="confirm-btns">
                    <button className="confirm-btn-cancel" onClick={handleCancel}>
                        <X size={16} /> {t('cancel') || 'Cancel'}
                    </button>
                    <button className="confirm-btn-proceed" onClick={handleConfirm}>
                        <Check size={16} /> {t('confirm') || 'Confirm'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default GlobalConfirmationBar;
