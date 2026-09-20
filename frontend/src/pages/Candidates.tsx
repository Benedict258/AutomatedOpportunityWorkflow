import { Plus, Search, Users, Mail, Phone, MapPin, GraduationCap, Briefcase, Star } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'

const candidates = [
  { id: 1, name: 'John Doe', email: 'john.doe@email.com', location: 'San Francisco, CA', skills: ['Python', 'TensorFlow', 'MLOps'], experience: '5 years', matches: 12, status: 'Active' },
  { id: 2, name: 'Jane Smith', email: 'jane.smith@email.com', location: 'New York, NY', skills: ['PyTorch', 'NLP', 'Research'], experience: '3 years', matches: 8, status: 'Active' },
  { id: 3, name: 'Alex Chen', email: 'alex.chen@email.com', location: 'Seattle, WA', skills: ['Computer Vision', 'PyTorch', 'AWS'], experience: '4 years', matches: 15, status: 'Passive' },
  { id: 4, name: 'Maria Garcia', email: 'maria.garcia@email.com', location: 'Austin, TX', skills: ['MLOps', 'Kubernetes', 'GCP'], experience: '6 years', matches: 6, status: 'Active' },
  { id: 5, name: 'David Kim', email: 'david.kim@email.com', location: 'Boston, MA', skills: ['Reinforcement Learning', 'Python', 'Research'], experience: '2 years', matches: 10, status: 'Active' },
]

export function Candidates() {
  const [search, setSearch] = useState('')

  const filtered = candidates.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.skills.some(s => s.toLowerCase().includes(search.toLowerCase()))
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Candidates</h1>
          <p className="text-muted-foreground mt-1">Track and manage candidate profiles</p>
        </div>
        <button className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors">
          <Plus className="h-4 w-4" />
          Add Candidate
        </button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search candidates by name or skill..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((candidate) => (
          <div key={candidate.id} className="rounded-lg border bg-card p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold">{candidate.name}</h3>
                <p className="text-sm text-muted-foreground">{candidate.experience} experience</p>
              </div>
              <span className={cn(
                'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
                candidate.status === 'Active' 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-gray-100 text-gray-800'
              )}>
                {candidate.status}
              </span>
            </div>

            <div className="mt-4 space-y-2 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Mail className="h-4 w-4 shrink-0" />
                <span>{candidate.email}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="h-4 w-4 shrink-0" />
                <span>{candidate.location}</span>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-1">
              {candidate.skills.map((skill) => (
                <span key={skill} className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-primary/10 text-primary">
                  {skill}
                </span>
              ))}
            </div>

            <div className="mt-4 flex items-center justify-between pt-4 border-t border-border">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Star className="h-4 w-4" />
                <span>{candidate.matches} matches</span>
              </div>
              <button className="text-sm font-medium text-primary hover:text-primary/80">View Profile</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}