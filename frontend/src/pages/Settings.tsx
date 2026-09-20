import { Save, Database, Key, Bell, User, Shield } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'

export function Settings() {
  const [activeTab, setActiveTab] = useState('general')
  const [saved, setSaved] = useState(false)

  const tabs = [
    { id: 'general', label: 'General', icon: User },
    { id: 'database', label: 'Database', icon: Database },
    { id: 'api', label: 'API Keys', icon: Key },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'security', label: 'Security', icon: Shield },
  ]

  const handleSave = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your application preferences</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar navigation */}
        <div className="lg:w-64 flex-shrink-0">
          <nav className="rounded-lg border bg-card p-4" aria-label="Settings sections">
            <ul className="space-y-1">
              {tabs.map((tab) => (
                <li key={tab.id}>
                  <button
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      'w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                      activeTab === tab.id
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                    )}
                  >
                    <tab.icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                    {tab.label}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        {/* Content panels */}
        <div className="flex-1">
          {activeTab === 'general' && (
            <GeneralSettings onSave={handleSave} saved={saved} />
          )}
          {activeTab === 'database' && (
            <DatabaseSettings onSave={handleSave} saved={saved} />
          )}
          {activeTab === 'api' && (
            <ApiKeysSettings onSave={handleSave} saved={saved} />
          )}
          {activeTab === 'notifications' && (
            <NotificationSettings onSave={handleSave} saved={saved} />
          )}
          {activeTab === 'security' && (
            <SecuritySettings onSave={handleSave} saved={saved} />
          )}
        </div>
      </div>
    </div>
  )
}

function GeneralSettings({ onSave, saved }: { onSave: () => void; saved: boolean }) {
  return (
    <div className="rounded-lg border bg-card p-6 shadow-sm">
      <h2 className="text-xl font-semibold mb-6">General Settings</h2>
      <div className="space-y-6 max-w-2xl">
        <div>
          <label className="block text-sm font-medium mb-2">Application Name</label>
          <input
            type="text"
            defaultValue="Automated Opportunity Workflow"
            className="w-full px-4 py-2 border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">Default Timezone</label>
          <select className="w-full px-4 py-2 border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring">
            <option>America/New_York</option>
            <option>America/Chicago</option>
            <option>America/Denver</option>
            <option>America/Los_Angeles</option>
            <option>UTC</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">Date Format</label>
          <select className="w-full px-4 py-2 border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring">
            <option>MM/DD/YYYY</option>
            <option>DD/MM/YYYY</option>
            <option>YYYY-MM-DD</option>
          </select>
        </div>
        <div className="flex items-center justify-end pt-4 border-t border-border">
          <button
            onClick={onSave}
            className={cn(
              'inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors',
              saved ? 'bg-green-600 text-white' : 'bg-primary text-primary-foreground hover:bg-primary/90'
            )}
            disabled={saved}
          >
            <Save className="h-4 w-4" />
            {saved ? 'Saved!' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

function DatabaseSettings({ onSave, saved }: { onSave: () => void; saved: boolean }) {
  return (
    <div className="rounded-lg border bg-card p-6 shadow-sm">
      <h2 className="text-xl font-semibold mb-6">Database Configuration</h2>
      <div className="space-y-6 max-w-2xl">
        <div>
          <label className="block text-sm font-medium mb-2">PostgreSQL Connection URL</label>
          <input
            type="text"
            defaultValue="postgresql://user:pass@localhost:5432/opportunity_intelligence"
            className="w-full px-4 py-2 border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring font-mono text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">Connection Pool Size</label>
          <input
            type="number"
            defaultValue="10"
            min="1"
            max="100"
            className="w-full px-4 py-2 border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="flex items-center gap-4">
          <input type="checkbox" id="ssl" defaultChecked className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" />
          <label htmlFor="ssl" className="text-sm font-medium">Enable SSL</label>
        </div>
        <div className="flex items-center gap-4">
          <input type="checkbox" id="migrations" defaultChecked className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" />
          <label htmlFor="migrations" className="text-sm font-medium">Auto-run migrations on startup</label>
        </div>
        <div className="flex items-center justify-end pt-4 border-t border-border">
          <button
            onClick={onSave}
            className={cn(
              'inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors',
              saved ? 'bg-green-600 text-white' : 'bg-primary text-primary-foreground hover:bg-primary/90'
            )}
            disabled={saved}
          >
            <Save className="h-4 w-4" />
            {saved ? 'Saved!' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ApiKeysSettings({ onSave, saved }: { onSave: () => void; saved: boolean }) {
  return (
    <div className="rounded-lg border bg-card p-6 shadow-sm">
      <h2 className="text-xl font-semibold mb-6">API Keys</h2>
      <p className="text-sm text-muted-foreground mb-6">Manage external service API keys. Keys are encrypted at rest.</p>
      <div className="space-y-6 max-w-2xl">
        <div>
          <label className="block text-sm font-medium mb-2">NVIDIA API Key</label>
          <div className="relative">
            <input
              type="password"
              placeholder="nvapi-****************************"
              className="w-full px-4 py-2 border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring pr-10"
            />
            <button className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <span className="text-xs">Show</span>
            </button>
          </div>
          <p className="text-xs text-muted-foreground mt-1">Used for Nemotron-3-Ultra and embedding models</p>
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">OpenAI API Key (Optional)</label>
          <input
            type="password"
            placeholder="sk-****************************"
            className="w-full px-4 py-2 border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <p className="text-xs text-muted-foreground mt-1">Fallback for GPT-4o-mini and embeddings</p>
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">Webhook HMAC Secret</label>
          <input
            type="password"
            placeholder="******************************"
            className="w-full px-4 py-2 border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <p className="text-xs text-muted-foreground mt-1">Used for verifying n8n webhook signatures (min 32 chars)</p>
        </div>
        <div className="flex items-center justify-end pt-4 border-t border-border">
          <button
            onClick={onSave}
            className={cn(
              'inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors',
              saved ? 'bg-green-600 text-white' : 'bg-primary text-primary-foreground hover:bg-primary/90'
            )}
            disabled={saved}
          >
            <Save className="h-4 w-4" />
            {saved ? 'Saved!' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

function NotificationSettings({ onSave, saved }: { onSave: () => void; saved: boolean }) {
  const [emailEnabled, setEmailEnabled] = useState(true)
  const [slackEnabled, setSlackEnabled] = useState(false)

  return (
    <div className="rounded-lg border bg-card p-6 shadow-sm">
      <h2 className="text-xl font-semibold mb-6">Notifications</h2>
      <div className="space-y-6 max-w-2xl">
        <div className="space-y-4">
          <h3 className="font-medium">Email Notifications</h3>
          <div className="space-y-4 pl-4 border-l-2 border-border">
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={emailEnabled} onChange={(e) => setEmailEnabled(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" />
              <span className="text-sm">Enable email notifications</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer ml-6">
              <input type="checkbox" defaultChecked className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" />
              <span className="text-sm">High-priority matches</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer ml-6">
              <input type="checkbox" defaultChecked className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" />
              <span className="text-sm">Deadline reminders</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer ml-6">
              <input type="checkbox" className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" />
              <span className="text-sm">Weekly digest</span>
            </label>
            <div className="ml-6">
              <label className="block text-sm font-medium mb-1">Notification Email</label>
              <input
                type="email"
                defaultValue="benedictisaac258@gmail.com"
                className="w-full max-w-md px-4 py-2 border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="font-medium">Slack Integration</h3>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={slackEnabled} onChange={(e) => setSlackEnabled(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" />
            <span className="text-sm">Enable Slack notifications</span>
          </label>
          {slackEnabled && (
            <div className="pl-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Webhook URL</label>
                <input
                  type="text"
                  placeholder="https://hooks.slack.com/services/..."
                  className="w-full max-w-md px-4 py-2 border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Channel</label>
                <input
                  type="text"
                  placeholder="#opportunities"
                  className="w-full max-w-md px-4 py-2 border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end pt-4 border-t border-border">
          <button
            onClick={onSave}
            className={cn(
              'inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors',
              saved ? 'bg-green-600 text-white' : 'bg-primary text-primary-foreground hover:bg-primary/90'
            )}
            disabled={saved}
          >
            <Save className="h-4 w-4" />
            {saved ? 'Saved!' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

function SecuritySettings({ onSave, saved }: { onSave: () => void; saved: boolean }) {
  return (
    <div className="rounded-lg border bg-card p-6 shadow-sm">
      <h2 className="text-xl font-semibold mb-6">Security</h2>
      <div className="space-y-6 max-w-2xl">
        <div>
          <h3 className="font-medium mb-4">JWT Configuration</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">JWT Secret</label>
              <input
                type="password"
                placeholder="******************************"
                className="w-full px-4 py-2 border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <p className="text-xs text-muted-foreground mt-1">Minimum 32 characters</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Token Expiry</label>
              <select className="w-full max-w-xs px-4 py-2 border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring">
                <option>1h</option>
                <option>4h</option>
                <option>8h</option>
                <option>24h</option>
                <option>7d</option>
              </select>
            </div>
          </div>
        </div>

        <div>
          <h3 className="font-medium mb-4">API Key Settings</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">API Key Prefix</label>
              <input
                type="text"
                defaultValue="aow_"
                className="w-full max-w-xs px-4 py-2 border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Rate Limit (requests/minute)</label>
              <input
                type="number"
                defaultValue="100"
                min="10"
                max="1000"
                className="w-full max-w-xs px-4 py-2 border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end pt-4 border-t border-border">
          <button
            onClick={onSave}
            className={cn(
              'inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors',
              saved ? 'bg-green-600 text-white' : 'bg-primary text-primary-foreground hover:bg-primary/90'
            )}
            disabled={saved}
          >
            <Save className="h-4 w-4" />
            {saved ? 'Saved!' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}