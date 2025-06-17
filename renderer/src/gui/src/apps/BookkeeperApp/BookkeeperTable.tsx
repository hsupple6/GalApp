import './BookkeeperApp.scss';

import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import React from 'react';

import { Transaction } from '../../types';



interface BookkeeperTableProps {
  transactions: Transaction[];
  onUpdateTransaction: (id: string, field: keyof Transaction, value: any) => void;
}

const BookkeeperTable: React.FC<BookkeeperTableProps> = ({
  transactions,
  onUpdateTransaction,
}) => {
  // Define columns with inline editing
  const columns = React.useMemo<ColumnDef<Transaction>[]>(
    () => [
      {
        accessorKey: 'date',
        header: 'Date',
        cell: ({ row, getValue }) => (
          <input
            type="date"
            value={getValue() as string}
            onChange={(e) => onUpdateTransaction(row.original.id, 'date', e.target.value)}
          />
        ),
      },
      {
        accessorKey: 'description',
        header: 'Description',
        cell: ({ row, getValue }) => (
          <input
            type="text"
            value={getValue() as string}
            onChange={(e) =>
              onUpdateTransaction(row.original.id, 'description', e.target.value)
            }
          />
        ),
      },
      {
        accessorKey: 'amount',
        header: 'Amount',
        cell: ({ row, getValue }) => (
          <input
            type="number"
            value={(getValue() as number).toFixed(2)}
            onChange={(e) =>
              onUpdateTransaction(row.original.id, 'amount', parseFloat(e.target.value))
            }
          />
        ),
      },
      {
        accessorKey: 'category',
        header: 'Category',
        cell: ({ row, getValue }) => (
          <input
            type="text"
            value={getValue() as string}
            onChange={(e) =>
              onUpdateTransaction(row.original.id, 'category', e.target.value)
            }
          />
        ),
      },
      {
        accessorKey: 'class',
        header: 'Class',
        cell: ({ row, getValue }) => (
          <input
            type="text"
            value={getValue() as string}
            onChange={(e) =>
              onUpdateTransaction(row.original.id, 'class', e.target.value)
            }
          />
        ),
      },
      {
        accessorKey: 'tags',
        header: 'Tags',
        cell: ({ row, getValue }) => (
          <input
            type="text"
            value={(getValue() as string[]).join(', ')}
            onChange={(e) =>
              onUpdateTransaction(
                row.original.id,
                'tags',
                e.target.value.split(',').map((tag) => tag.trim())
              )
            }
          />
        ),
      },
    ],
    [onUpdateTransaction]
  );

  const table = useReactTable({
    data: transactions,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <table className="bookkeeper-table">
      <thead>
        {table.getHeaderGroups().map((headerGroup) => (
          <tr key={headerGroup.id}>
            {headerGroup.headers.map((header) => (
              <th key={header.id}>
                {flexRender(header.column.columnDef.header, header.getContext())}
              </th>
            ))}
          </tr>
        ))}
      </thead>
      <tbody>
        {table.getRowModel().rows.map((row) => (
          <tr key={row.id}>
            {row.getVisibleCells().map((cell) => (
              <td key={cell.id}>
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export default BookkeeperTable;
