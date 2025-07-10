
import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2 } from 'lucide-react';

export interface TableRowData {
  productName: string;
  subscriptionTime: string;
  dataDeadline: string;
  subscriptionAmount: string;
  marketValue: string;
  totalAfterDeduction: string;
  estimatedProfit: string;
}

interface InvestmentTableProps {
  tableData: TableRowData[];
  onAddRow: () => void;
  onRemoveRow: (index: number) => void;
  onUpdateCell: (rowIndex: number, field: keyof TableRowData, value: string) => void;
}

const InvestmentTable = ({ 
  tableData, 
  onAddRow, 
  onRemoveRow, 
  onUpdateCell 
}: InvestmentTableProps) => {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <Label className="text-lg font-semibold">Investment Portfolio</Label>
        <Button onClick={onAddRow} size="sm" variant="outline">
          <Plus className="w-4 h-4 mr-2" />
          Add Row
        </Button>
      </div>
      
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product Name</TableHead>
              <TableHead>Subscription Time</TableHead>
              <TableHead>Data Deadline</TableHead>
              <TableHead>Subscription Amount</TableHead>
              <TableHead>Market Value</TableHead>
              <TableHead>Total After Deduction</TableHead>
              <TableHead>Estimated Profit (%)</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tableData.map((row, index) => (
              <TableRow key={index}>
                <TableCell>
                  <Input
                    value={row.productName}
                    onChange={(e) => onUpdateCell(index, 'productName', e.target.value)}
                    className="min-w-[200px]"
                  />
                </TableCell>
                <TableCell>
                  <Input
                    value={row.subscriptionTime}
                    onChange={(e) => onUpdateCell(index, 'subscriptionTime', e.target.value)}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    value={row.dataDeadline}
                    onChange={(e) => onUpdateCell(index, 'dataDeadline', e.target.value)}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    value={row.subscriptionAmount}
                    onChange={(e) => onUpdateCell(index, 'subscriptionAmount', e.target.value)}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    value={row.marketValue}
                    onChange={(e) => onUpdateCell(index, 'marketValue', e.target.value)}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    value={row.totalAfterDeduction}
                    onChange={(e) => onUpdateCell(index, 'totalAfterDeduction', e.target.value)}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    value={row.estimatedProfit}
                    onChange={(e) => onUpdateCell(index, 'estimatedProfit', e.target.value)}
                  />
                </TableCell>
                <TableCell>
                  <Button
                    onClick={() => onRemoveRow(index)}
                    size="sm"
                    variant="destructive"
                    disabled={tableData.length <= 1}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default InvestmentTable;