import './ModalWrapper.scss'; // Style the modal (we'll create this next)

import React from 'react';

interface ModalWrapperProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
}

const ModalWrapper: React.FC<ModalWrapperProps> = ({
    isOpen,
    onClose,
    title,
    children,
}) => {
    if (!isOpen) return null;

    return (
        <div className="modalOverlay">
            <div className="modalContent">
                <div className="modalHeader">
                    <h2>{title}</h2>
                    <button onClick={onClose} className="closeButton">
                        X
                    </button>
                </div>
                <div className="modalBody">{children}</div>
            </div>
        </div>
    );
};

export default ModalWrapper;
