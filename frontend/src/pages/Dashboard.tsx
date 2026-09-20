import { TrendingUp, Users, Briefcase, AlertTriangle, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

const stats = [
  { name: 'Total Opportunities', value: '247', change: '+12%', icon: Briefcase, color: 'text-blue-600' },
  { name: 'Active Candidates', value: '89', change: '+5%', icon: Users, color: 'text-green-600' },
  { name: 'Matches This Week', value: '34', change: '+23%', icon: TrendingUp, color: 'text-purple-600' },
  { name: 'Pending Reviews', value: '8', change: '-2%', icon: AlertTriangle, color: 'text-orange-600' },
]

const recentActivity = [
  { id: 1, type: 'match', title: 'High match found', detail: 'Senior ML Engineer at TechCorp matched with candidate John D.', time: '2 min ago' },
  { id: 2, type: 'opportunity', title: 'New opportunity discovered', detail: 'AI Research Fellowship at Stanford University', time: '15 min ago' },
  { id: 3, type: 'candidate', title: 'Candidate profile updated', detail: 'Jane Smith added new certifications', time: '1 hour ago' },
  { id: 4, type: 'deadline', title: 'Deadline approaching', detail: 'Google PhD Fellowship due in 3 days', time: '3 hours ago' },
]

export function Dashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Overview of your opportunity intelligence pipeline</p>
      </div>

      {/* Stats grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.name}
            className="rounded-lg border bg-card p-6 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">{stat.name}</p>
                <p className="text-3xl font-bold mt-1">{stat.value}</p>
              </div>
              <div className={cn('p-3 rounded-full bg-primary/10', stat.color)}>
                <stat.icon className="h-6 w-6" aria-hidden="true" />
              </div>
            </div>
            <p className={cn('text-sm mt-4', stat.change.startsWith('+') ? 'text-green-600' : 'text-red-600')}>
              {stat.change} vs last week
            </p>
          </div>
        ))}
      </div>

      {/* Recent activity */}
      <div className="rounded-lg border bg-card shadow-sm">
        <div className="border-b border-border px-6 py-4">
          <h2 className="text-lg font-semibold">Recent Activity</h2>
        </div>
        <div className="divide-y divide-border">
          {recentActivity.map((activity) => (
            <div key={activity.id} className="px-6 py-4 flex items-center gap-4 hover:bg-accent/50 transition-colors">
              <div className={cn('p-2 rounded-full', 
                activity.type === 'match' && 'bg-green-100 text-green-600',
                activity.type === 'opportunity' && 'bg-blue-100 text-blue-600',
                activity.type === 'candidate' && 'bg-purple-100 text-purple-600',
                activity.type === 'deadline' && 'bg-orange-100 text-orange-600'
              )}>
                {activity.type === 'match' && <TrendingUp className="h-4 w-4" />}
                {activity.type === 'opportunity' && <Briefcase className="h-4 w-4" />}
                {activity.type === 'candidate' && <Users className="h-4 w-4" />}
                {activity.type === 'deadline' && <Clock className="h-4 w-4" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{activity.title}</p>
                <p className="text-sm text-muted-foreground truncate">{activity.detail}</p>
              </div>
              <p className="text-sm text-muted-foreground whitespace-nowrap">{activity.time}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}