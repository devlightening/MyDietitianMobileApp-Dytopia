'use client'

import { useQuery } from '@tanstack/react-query'
import { TrendingUp, Users, Target, Mail } from 'lucide-react'
import { useState } from 'react'

interface ExpiredClient {
  id: string
  fullName: string
  email: string
  createdAtUtc: string
  lastPlanEndDate: string | null
  planCount: number
}

export default function RetentionPage() {
  const [selectedClients, setSelectedClients] = useState<Set<string>>(new Set())

  const { data, isLoading } = useQuery({
    queryKey: ['expired-clients'],
    queryFn: async () => {
      const res = await fetch('/api/dietitian/retention/expired-clients')
      if (!res.ok) {
        return { total: 0, clients: [] }
      }
      return res.json() as Promise<{ total: number; clients: ExpiredClient[] }>
    }
  })

  const toggleClient = (id: string) => {
    const newSet = new Set(selectedClients)
    if (newSet.has(id)) {
      newSet.delete(id)
    } else {
      newSet.add(id)
    }
    setSelectedClients(newSet)
  }

  const selectAll = () => {
    if (data?.clients) {
      setSelectedClients(new Set(data.clients.map(c => c.id)))
    }
  }

  const clearSelection = () => {
    setSelectedClients(new Set())
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <TrendingUp className="w-7 h-7" />
          Client Retention
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Re-engage expired clients with targeted campaigns
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Expired Clients</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">
                {data?.total || 0}
              </p>
            </div>
            <Users className="w-12 h-12 text-red-500 opacity-20" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Selected</p>
              <p className="text-3xl font-bold text-blue-600 dark:text-blue-400 mt-1">
                {selectedClients.size}
              </p>
            </div>
            <Target className="w-12 h-12 text-blue-500 opacity-20" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Potential Revenue</p>
              <p className="text-3xl font-bold text-green-600 dark:text-green-400 mt-1">
                ${selectedClients.size * 99}
              </p>
            </div>
            <Mail className="w-12 h-12 text-green-500 opacity-20" />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            <button
              onClick={selectAll}
              className="px-4 py-2 text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg"
            >
              Select All
            </button>
            <button
              onClick={clearSelection}
              className="px-4 py-2 text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg"
            >
              Clear Selection
            </button>
          </div>
          <button
            disabled={selectedClients.size === 0}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg font-medium flex items-center gap-2"
          >
            <Mail className="w-5 h-5" />
            Create Campaign ({selectedClients.size})
          </button>
        </div>
      </div>

      {/* Client List */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Select
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Client
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Last Plan Ended
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Total Plans
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    Loading...
                  </td>
                </tr>
              ) : data?.clients.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    No expired clients found
                  </td>
                </tr>
              ) : (
                data?.clients.map((client) => (
                  <tr
                    key={client.id}
                    className={`hover:bg-gray-50 dark:hover:bg-gray-700 ${selectedClients.has(client.id) ? 'bg-blue-50 dark:bg-blue-900/10' : ''
                      }`}
                  >
                    <td className="px-6 py-4">
                      <input
                        type="checkbox"
                        checked={selectedClients.has(client.id)}
                        onChange={() => toggleClient(client.id)}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">
                      {client.fullName}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                      {client.email || 'No email'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                      {client.lastPlanEndDate
                        ? new Date(client.lastPlanEndDate).toLocaleDateString()
                        : 'Never'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                      {client.planCount}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
