import './ModalSettings.scss';

import React, { useState } from 'react';

import ModalWrapper from './ModalWrapper';

interface ModalSettingsProps {
  entityTypes: string[];
  selectedEntityTypes: string[];
  isOpen: boolean;
  onClose: () => void;
  onSave: (selected: string[]) => void;
}

const ModalSettings: React.FC<ModalSettingsProps> = ({
  entityTypes,
  selectedEntityTypes,
  isOpen,
  onClose,
  onSave,
}) => {
  const [selected, setSelected] = useState<string[]>(selectedEntityTypes);

  const handleToggle = (type: string) => {
    setSelected(prevSelected =>
      prevSelected.includes(type)
        ? prevSelected.filter(t => t !== type)
        : [...prevSelected, type]
    );
  };

  const handleSave = () => {
    onSave(selected);
    onClose();
  };

  return (
    <ModalWrapper isOpen={isOpen} onClose={onClose} title="Settings">
      <div className="modalSettings">
        <p>Select which entity types to include in the query:</p>
        <ul>
          {entityTypes.map(type => (
            <li key={type}>
              <label>
                <input
                  type="checkbox"
                  checked={selected.includes(type)}
                  onChange={() => handleToggle(type)}
                />
                {type}
              </label>
            </li>
          ))}
        </ul>
        <button onClick={handleSave}>Save</button>
        <button onClick={onClose}>Cancel</button>
      </div>
    </ModalWrapper>
  );
};

export default ModalSettings;
