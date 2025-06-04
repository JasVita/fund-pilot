// app/dashboard/page.tsx

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function Dashboard() {
  const mockUsers = [
    { id: 1, name: 'John Doe', portfolioValue: '$12,500', returns: '+7%' },
    { id: 2, name: 'Jane Smith', portfolioValue: '$15,200', returns: '+12%' },
    { id: 3, name: 'Alice Johnson', portfolioValue: '$8,700', returns: '+4%' },
  ];

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Fundpilot Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {mockUsers.map((user) => (
          <Card key={user.id}>
            <CardHeader>
              <CardTitle>{user.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <p><strong>Portfolio Value:</strong> {user.portfolioValue}</p>
              <p><strong>Returns:</strong> {user.returns}</p>
              <div className="mt-4 text-right">
                <Button asChild>
                  <Link href={`/dashboard/users/${user.id}`}>View Details</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}