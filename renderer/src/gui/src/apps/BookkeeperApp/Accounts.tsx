import './Accounts.scss';

import React, { useState } from 'react';

import SelectInstitutionModal from './SelectInstitutionModal';

interface Account {
  id: string;
  name: string;
  institutionName: string;
  lastSyncDate: string;
}

const Accounts: React.FC = () => {
  const [accounts, setAccounts] = useState<Account[]>([]); // List of connected accounts
  const [showModal, setShowModal] = useState(false); // Controls the modal visibility

  const addAccount = (newAccount: Account) => {
    setAccounts([...accounts, newAccount]);
    setShowModal(false);
  };

  return (
    <div className="accounts-page">
      <h1>Accounts</h1>
      <button onClick={() => setShowModal(true)} className="add-account-btn">+</button>
      <ul className="account-list">
        {accounts.map((account) => (
          <li key={account.id} className="account-item">
            <div>
              <h3>{account.institutionName}</h3>
              <p>Account Name: {account.name}</p>
              <p>Last Synced: {account.lastSyncDate}</p>
            </div>
          </li>
        ))}
      </ul>

      {showModal && (
        <SelectInstitutionModal onClose={() => setShowModal(false)} onAccountAdded={addAccount} />
      )}
    </div>
  );
};

export default Accounts;
