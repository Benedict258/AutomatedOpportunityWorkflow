import { Plus, Search, Filter, ChevronDown, Briefcase, Building, MapPin, DollarSign, Clock } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'

const opportunities = [
  { id: 1, title: 'Senior ML Engineer', company: 'TechCorp', location: 'San Francisco, CA', type: 'Full-time', salary: '$180k-$250k', deadline: '2026-10-15', match: 92 },
  { id: 2, title: 'AI Research Scientist', company: 'Google DeepMind', location: 'London, UK', type: 'Full-time', salary: 'Competitive', deadline: '2026-11-01', match: 88 },
  { id: 3, title: 'PhD Fellowship - Computer Vision', company: 'Stanford University', location: 'Stanford, CA', type: 'Fellowship', salary: '$50k/year', deadline: '2026-09-30', match: 95 },
  { id: 4, title: 'MLOps Engineer', company: 'DataFlow Inc', location: 'Remote', type: 'Full-time', salary: '$140k-$180k', deadline: '2026-10-20', match: 76 },
  { id: 5, title: 'Research Intern - NLP', company: 'Meta AI', location: 'New York, NY', type: 'Internship', salary: '$8k/month', deadline: '2026-10-10', match: 82 },
]

export function Opportunities() {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')

  const filtered = opportunities.filter(o => 
    o.title.toLowerCase().includes(search.toLowerCase()) ||
    o.company.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Opportunities</h1>
          <p className="text-muted-foreground mt-1">Discovered and tracked opportunities</p>
        </div>
        <button className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors">
          <Plus className="h-4 w-4" />
          Add Opportunity
        </button>
      </div>

      {/* Search and filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search opportunities..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="flex gap-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-4 py-2 border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="all">All Types</option>
            <option value="full-time">Full-time</option>
            <option value="internship">Internship</option>
            <option value="fellowship">Fellowship</option>
          </select>
          <button className="flex items-center gap-2 px-4 py-2 border border-input rounded-lg bg-background hover:bg-accent transition-colors">
            <Filter className="h-4 w-4" />
            <ChevronDown className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Opportunities table */}
      <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Opportunity</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Company</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider hidden md:table-cell">Location</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Type</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Salary</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Match</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Deadline</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((opp) => (
              <tr key={opp.id} className="hover:bg-accent/50 transition-colors">
                <td className="px-6 py-4">
                  <div>
                    <p className="font-medium">{opp.title}</p>
                    <p className="text-sm text-muted-foreground">ID: {opp.id}</p>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <Building className="h-4 w-4 text-muted-foreground" />
                    <span>{opp.company}</span>
                  </div>
                </td>
                <td className="px-6 py-4 hidden md:table-cell">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span>{opp.location}</span>
                  </div>
                </td>
                <td className="px-6 py-4 hidden lg:table-cell">
                  <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-secondary text-secondary-foreground">
                    {opp.type}
                  </span>
                </td>
                <td className="px-6 py-4 hidden lg:table-cell">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    <span>{opp.salary}</span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <div className="relative w-24">
                      <div className="h-2 bg-secondary rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary rounded-full transition-all" 
                          style={{ width: `${opp.match}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-sm font-medium text-primary">{opp.match}%</span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>{new Date(opp.deadline).toLocaleDateString()}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-right">
                  <button className="text-sm font-medium text-primary hover:text-primary/80">View</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}