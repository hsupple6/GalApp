import './SelectInstitutionModal.scss';

import React from 'react';

interface Institution {
  id: string;
  name: string;
}

interface SelectInstitutionModalProps {
  onClose: () => void;
  onAccountAdded: (account: { id: string; name: string; institutionName: string; lastSyncDate: string }) => void;
}

const institutions: Institution[] = [
  { id: '1', name: 'Bank of America' },
  { id: '2', name: 'Chase' },
  { id: '3', name: 'Wells Fargo' },
  // Add more institutions or dynamically load this list if needed
];

const SelectInstitutionModal: React.FC<SelectInstitutionModalProps> = ({ onClose, onAccountAdded }) => {
  const handleSelectInstitution = (institution: Institution) => {
    // Simulate adding an account after selecting an institution
    const newAccount = {
      id: Math.random().toString(36).substring(2), // Temporary ID generator
      name: `My ${institution.name} Account`,
      institutionName: institution.name,
      lastSyncDate: new Date().toLocaleDateString(),
    };
    onAccountAdded(newAccount);
  };

  return (
    <div className="select-institution-modal">
      <div className="modal-content">
        <h2>Select Your Institution</h2>
        <ul className="institution-list">
          {institutions.map((institution) => (
            <li key={institution.id} onClick={() => handleSelectInstitution(institution)} className="institution-item">
              {institution.name}
            </li>
          ))}
        </ul>
        <button onClick={onClose}>Close</button>
      </div>
    </div>
  );
};

export default SelectInstitutionModal;
