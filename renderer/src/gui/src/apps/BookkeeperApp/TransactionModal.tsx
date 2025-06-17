import './BookkeeperApp.scss';

import React, { useState } from 'react';

interface TransactionModalProps {
  onClose: () => void;
  onSave: (transaction: any) => void;
}

const TransactionModal: React.FC<TransactionModalProps> = ({ onClose, onSave }) => {
  const [date, setDate] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState(0);
  const [category, setCategory] = useState('');
  const [transactionClass, setTransactionClass] = useState('');
  const [tags, setTags] = useState<string[]>([]);

  const handleSave = () => {
    const newTransaction = {
      id: Math.random().toString(36).substring(2, 15), // Temporary ID generator
      date,
      description,
      amount,
      category,
      class: transactionClass,
      tags,
    };
    onSave(newTransaction);
    onClose();
  };

  return (
    <div className="transaction-modal">
      <div className="modal-content">
        <h2>Add New Transaction</h2>
        <label>Date</label>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        
        <label>Description</label>
        <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} />

        <label>Amount</label>
        <input type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} />

        <label>Category</label>
        <input type="text" value={category} onChange={(e) => setCategory(e.target.value)} />

        <label>Class</label>
        <input type="text" value={transactionClass} onChange={(e) => setTransactionClass(e.target.value)} />

        <label>Tags</label>
        <input type="text" value={tags.join(', ')} onChange={(e) => setTags(e.target.value.split(',').map(tag => tag.trim()))} />

        <button onClick={handleSave}>Save</button>
        <button onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
};

export default TransactionModal;
