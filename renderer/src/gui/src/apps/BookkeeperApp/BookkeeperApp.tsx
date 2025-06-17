import './BookkeeperApp.scss';

import React, { useState } from 'react';

import { Transaction } from '../../types';
import WindowWrapper from '../../WindowWrapper';
import Accounts from './Accounts';
import BookkeeperTable from './BookkeeperTable';
import TransactionModal from './TransactionModal';

interface BookkeeperAppProps {
  title: string;
  onClose: () => void;
  isTab?: boolean;
}

type Page = 'transactions' | 'accounts';

const BookkeeperApp: React.FC<BookkeeperAppProps> = ({ title, onClose, isTab = false }) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]); // Initialize as Transaction[]
  const [showModal, setShowModal] = useState(false);
  const [currentPage, setCurrentPage] = useState<Page>('transactions');

  // Function to add a new transaction
  const addTransaction = (transaction: Transaction) => {
    setTransactions([...transactions, transaction]);
  };

  // Function to handle inline edits in BookkeeperTable
  const onUpdateTransaction = (id: string, field: keyof Transaction, value: any) => {
    setTransactions((prevTransactions) =>
      prevTransactions.map((transaction) =>
        transaction.id === id ? { ...transaction, [field]: value } : transaction
      )
    );
  };

  // CSV Export Function
  const exportCSV = () => {
    const csvContent = transactions.map((transaction) =>
      [
        transaction.date,
        transaction.description,
        transaction.amount,
        transaction.category,
        transaction.class,
        transaction.tags.join(';') // Separate tags by semicolon
      ].join(',')
    );

    const csvBlob = new Blob([['Date,Description,Amount,Category,Class,Tags\n', ...csvContent].join('\n')], {
      type: 'text/csv',
    });
    const csvUrl = URL.createObjectURL(csvBlob);
    const downloadLink = document.createElement('a');
    downloadLink.href = csvUrl;
    downloadLink.download = 'transactions.csv';
    downloadLink.click();
    URL.revokeObjectURL(csvUrl);
  };

  return (
    <WindowWrapper title={title} onClose={onClose} isTab={isTab}>
      <div className="bookkeeper-app">
        <header className="bookkeeper-toolbar">
          {/* Page Navigation */}
          <button onClick={() => setCurrentPage('transactions')} className={currentPage === 'transactions' ? 'active' : ''}>Transactions</button>
          <button onClick={() => setCurrentPage('accounts')} className={currentPage === 'accounts' ? 'active' : ''}>Accounts</button>
          
          {/* Only show buttons related to Transactions page */}
          {currentPage === 'transactions' && (
            <>
              <button onClick={() => setShowModal(true)}>Add Transaction</button>
              <button onClick={exportCSV}>Export CSV</button>
            </>
          )}
        </header>

        {/* Conditional Rendering Based on Current Page */}
        {currentPage === 'transactions' ? (
          <>
            <BookkeeperTable transactions={transactions} onUpdateTransaction={onUpdateTransaction} />
            {showModal && (
              <TransactionModal
                onClose={() => setShowModal(false)}
                onSave={addTransaction}
              />
            )}
          </>
        ) : (
          <Accounts />
        )}
      </div>
    </WindowWrapper>
  );
};

export default BookkeeperApp;
