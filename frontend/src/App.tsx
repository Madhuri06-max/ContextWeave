
import { useEffect, useState } from 'react'
import {
  Activity,
  ArrowRight,
  BellRing,
  CalendarClock,
  CheckCircle2,
  CircleAlert,
  ClipboardList,
  Clock3,
  History,
  Layers3,
  LoaderCircle,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Workflow,
} from 'lucide-react'
import './App.css'

const API = 'http://127.0.0.1:8000'

type Page = 'overview' | 'activity' | 'actionguard'

type Action = {
  action_id?: string
  id?: string
  action_type?: string
  type?: string
  description?: string
  title?: string
  status?: string
  requires_approval?: boolean
  approved?: boolean
  allow_duplicate?: boolean
  [key: string]: unknown
}

type Plan = {
  plan_id?: string
  id?: string
  actions?: Action[]
  steps?: Action[]
  [key: string]: unknown
}

type DuplicateWarning = {
  action: Action
  message: string
  existingTaskId?: number
}

type SavedTask = {
  id: number
  title: string
  status?: string
  created_at?: string
}

type SavedReminder = {
  id: number
  title: string
  reminder_time?: string | null
  status?: string
  created_at?: string
}

type HistoryItem = {
  id: number
  action_key?: string
  action_type?: string
  description?: string
  status?: string
  result?: string
  created_at?: string
}

function formatDate(value?: string | null) {
  if (!value) return 'Not scheduled'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function isSensitiveAction(action: Action) {
  const type = (
    action.action_type ??
    action.type ??
    ''
  ).toLowerCase()

  return (
    action.requires_approval === true ||
    ['message', 'send_message', 'email', 'payment'].includes(type)
  )
}

function App() {
  const [activePage, setActivePage] = useState<Page>('overview')
  const [request, setRequest] = useState('')
  const [plan, setPlan] = useState<Plan | null>(null)
  const [approved, setApproved] = useState(false)
  const [duplicateWarning, setDuplicateWarning] =
    useState<DuplicateWarning | null>(null)

  const [loading, setLoading] = useState(false)
  const [executing, setExecuting] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [health, setHealth] = useState('Checking')

  const [tasks, setTasks] = useState<SavedTask[]>([])
  const [reminders, setReminders] = useState<SavedReminder[]>([])
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [dataError, setDataError] = useState('')

  async function checkHealth() {
    try {
      const response = await fetch(`${API}/health`)
      if (!response.ok) throw new Error('Backend unavailable')
      setHealth('Connected')
    } catch {
      setHealth('Disconnected')
    }
  }

  async function refreshSavedData() {
    try {
      const response = await fetch(`${API}/state`)
      if (!response.ok) {
        throw new Error('Could not load saved tasks and reminders.')
      }

      const data = await response.json()
      setTasks(Array.isArray(data.tasks) ? data.tasks : [])
      setReminders(Array.isArray(data.reminders) ? data.reminders : [])
      setDataError('')
    } catch (err) {
      setDataError(
        err instanceof Error ? err.message : 'Could not load saved data.',
      )
    }
  }

  async function refreshHistory() {
    try {
      const response = await fetch(`${API}/history`)
      if (!response.ok) throw new Error('Could not load action history.')

      const data = await response.json()
      setHistory(Array.isArray(data) ? data : [])
      setDataError('')
    } catch (err) {
      setDataError(
        err instanceof Error ? err.message : 'Could not load action history.',
      )
    }
  }

  async function refreshAll() {
    setRefreshing(true)
    await Promise.all([
      refreshSavedData(),
      refreshHistory(),
      checkHealth(),
    ])
    setRefreshing(false)
  }

  useEffect(() => {
    void refreshAll()
  }, [])

  async function createPlan() {
    if (!request.trim()) {
      setError('Enter a request first.')
      return
    }

    setLoading(true)
    setError('')
    setNotice('')
    setPlan(null)
    setApproved(false)
    setDuplicateWarning(null)

    try {
      const response = await fetch(`${API}/plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request: request.trim() }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.detail || 'Could not create a plan.')
      }

      setPlan(data)
    } catch (err) {
      setError(
        err instanceof Error
          ? `${err.message} Check that your backend is running.`
          : 'Could not connect to the backend.',
      )
    } finally {
      setLoading(false)
    }
  }

  async function executePlan(allowDuplicate = false) {
    if (!plan) return

    const plannedActions = plan.actions ?? plan.steps ?? []

    const sensitiveActions = plannedActions.filter(isSensitiveAction)

    if (sensitiveActions.length > 0 && !approved) {
      setError(
        'Action blocked — approval is required before sensitive actions can proceed.',
      )
      setNotice('')
      return
    }

    setExecuting(true)
    setError('')
    setNotice('')

    try {
      const approvals = Object.fromEntries(
        plannedActions
          .filter((action) => action.action_id || action.id)
          .map((action) => [
            action.action_id ?? action.id!,
            isSensitiveAction(action) ? approved : true,
          ]),
      )

      const duplicateActionId = duplicateWarning
        ? duplicateWarning.action.action_id ?? duplicateWarning.action.id
        : undefined

      const requestPlan: Plan = {
        ...plan,
        actions: plannedActions.map((action) => {
          const actionId = action.action_id ?? action.id

          if (
            allowDuplicate &&
            duplicateActionId &&
            actionId === duplicateActionId
          ) {
            return { ...action, allow_duplicate: true }
          }

          return action
        }),
      }

      const response = await fetch(`${API}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan_id: plan.plan_id ?? plan.id,
          plan: requestPlan,
          approvals,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.detail || 'Execution failed.')
      }

      const results: {
        id?: string
        status?: string
        result?: string
        message?: string
        existing_task_id?: number
      }[] = Array.isArray(data.results) ? data.results : []

      const warningResult = results.find(
        (item) => item.status === 'duplicate_warning',
      )

      if (warningResult) {
        const matchingAction = plannedActions.find(
          (action) =>
            (action.action_id ?? action.id) === warningResult.id,
        )

        if (matchingAction) {
          setDuplicateWarning({
            action: matchingAction,
            message: warningResult.result ?? 'This task already exists.',
            existingTaskId: warningResult.existing_task_id,
          })
        } else {
          setError(
            warningResult.result ??
              'A duplicate task was detected, but its action could not be matched.',
          )
        }

        setNotice('')
      } else {
        setDuplicateWarning(null)

        const messages: string[] = []

        if (typeof data.message === 'string') messages.push(data.message)
        if (typeof data.result === 'string') messages.push(data.result)

        results.forEach((item) => {
          if (typeof item.result === 'string') {
            messages.push(item.result)
          } else if (typeof item.message === 'string') {
            messages.push(item.message)
          }
        })

        setNotice(
          messages.join(' ') ||
            'Request processed. Check Activity for recorded results.',
        )
      }

      await Promise.all([refreshSavedData(), refreshHistory()])
    } catch (err) {
      setError(
        err instanceof Error
          ? `${err.message} Check the /execute endpoint in http://127.0.0.1:8000/docs.`
          : 'Could not execute the plan.',
      )
    } finally {
      setExecuting(false)
    }
  }

  const actions = plan?.actions ?? plan?.steps ?? []

  function navigate(page: Page) {
    setActivePage(page)
    setError('')
    setNotice('')
    setDataError('')

    if (page === 'activity') void refreshHistory()
    if (page === 'overview') void refreshSavedData()
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <Workflow size={24} />
          </div>
          <div className="brand-copy">
            <strong>ContextWeave</strong>
            <span>Personal workflow assistant</span>
          </div>
        </div>

        <div className="nav-label">WORKSPACE</div>

        <button
          type="button"
          className={`nav-item ${activePage === 'overview' ? 'active' : ''}`}
          onClick={() => navigate('overview')}
        >
          <Layers3 size={18} />
          <span>Overview</span>
        </button>

        <button
          type="button"
          className={`nav-item ${activePage === 'activity' ? 'active' : ''}`}
          onClick={() => navigate('activity')}
        >
          <Activity size={18} />
          <span>Activity</span>
        </button>

        <button
          type="button"
          className={`nav-item ${activePage === 'actionguard' ? 'active' : ''}`}
          onClick={() => navigate('actionguard')}
        >
          <ShieldCheck size={18} />
          <span>ActionGuard</span>
        </button>

        <div className="sidebar-bottom">
          <div className="sidebar-shield">
            <ShieldCheck size={21} />
          </div>
          <strong>Your actions, your control.</strong>
          <p>Review sensitive actions before they proceed.</p>
          <div className="privacy-pill">
            <span className="privacy-dot" />
            Approval-aware prototype
          </div>
        </div>
      </aside>

      <section className="main-panel">
        <header className="topbar">
          <div className="topbar-copy">
            <div className="eyebrow">
              WORKSPACE <span>/</span> {activePage.toUpperCase()}
            </div>

            <h1>
              {activePage === 'overview'
                ? 'Make your next move count.'
                : activePage === 'activity'
                  ? 'Your activity, in one place.'
                  : 'Your actions. Your permission.'}
            </h1>

            <p>
              {activePage === 'overview'
                ? 'Turn everyday requests into clear, reviewable workflows.'
                : activePage === 'activity'
                  ? 'Review the actions ContextWeave has recorded.'
                  : 'Understand how approval and safety safeguards work.'}
            </p>
          </div>

          <button
            type="button"
            className="connection"
            onClick={() => void checkHealth()}
            title="Check backend connection"
          >
            <span
              className={`status-dot ${health === 'Connected' ? 'online' : 'offline'}`}
            />
            {health}
          </button>
        </header>

        {error && (
          <div className="message error">
            <CircleAlert size={18} />
            <span>{error}</span>
          </div>
        )}

        {notice && activePage === 'overview' && (
          <div className="message success">
            <CheckCircle2 size={18} />
            <span>{notice}</span>
          </div>
        )}

        {dataError && (
          <div className="message error">
            <CircleAlert size={18} />
            <span>{dataError}</span>
          </div>
        )}

        {activePage === 'overview' && (
          <>
            <section className="welcome-card">
              <div className="welcome-copy">
                <div className="welcome-tag">
                  <Sparkles size={14} />
                  CONTEXT-AWARE WORKFLOWS
                </div>
                <h2>What would you like<br />to get done?</h2>
                <p>
                  Describe your goal naturally. ContextWeave will turn it into
                  steps you can review before execution.
                </p>
              </div>
              <div className="welcome-art">
                <div className="art-orbit orbit-one" />
                <div className="art-orbit orbit-two" />
                <Workflow size={76} strokeWidth={1.2} />
              </div>
            </section>

            <section className="composer card">
              <label htmlFor="request">YOUR REQUEST</label>
              <textarea
                id="request"
                value={request}
                onChange={(event) => setRequest(event.target.value)}
                placeholder="e.g. Create a task to finish my project and remind me tomorrow."
                rows={3}
              />

              <div className="composer-footer">
                <span className="composer-note">
                  <ShieldCheck size={15} />
                  Review your plan before proceeding.
                </span>

                <button
                  type="button"
                  className="primary-button"
                  onClick={() => void createPlan()}
                  disabled={loading}
                >
                  {loading ? (
                    <LoaderCircle className="spin" size={17} />
                  ) : (
                    <Sparkles size={17} />
                  )}
                  {loading ? 'Creating plan…' : 'Create a plan'}
                  {!loading && <ArrowRight size={16} />}
                </button>
              </div>
            </section>

            <section className="section-heading">
              <div>
                <div className="eyebrow">PLAN & REVIEW</div>
                <h2>Your workflow</h2>
              </div>
              <span className="step-count">
                {actions.length} {actions.length === 1 ? 'step' : 'steps'}
              </span>
            </section>

            {!plan ? (
              <section className="empty-state card">
                <div className="empty-icon">
                  <Workflow size={27} />
                </div>
                <strong>Your next workflow starts here</strong>
                <p>
                  Enter a request above and select Create a plan to see your
                  proposed steps.
                </p>
              </section>
            ) : (
              <section className="plan-card card">
                <div className="plan-title">
                  <div className="plan-icon">
                    <Workflow size={21} />
                  </div>
                  <div className="plan-title-copy">
                    <strong>Proposed action plan</strong>
                    <p>Review the proposed steps before continuing.</p>
                  </div>
                  <span className="review-badge">
                    <Clock3 size={13} />
                    Ready for review
                  </span>
                </div>

                {actions.length === 0 ? (
                  <pre className="json-result">
                    {JSON.stringify(plan, null, 2)}
                  </pre>
                ) : (
                  <div className="action-list">
                    {actions.map((action, index) => (
                      <div
                        className="action-row"
                        key={action.action_id ?? action.id ?? index}
                      >
                        <div className="action-number">{index + 1}</div>
                        <div className="action-copy">
                          <strong>
                            {action.title ??
                              action.description ??
                              action.action_type ??
                              action.type ??
                              'Workflow step'}
                          </strong>
                          <span>
                            {action.action_type ?? action.type ?? 'Action'}
                            {' · '}
                            {action.status ?? 'Planned'}
                          </span>
                        </div>
                        <CheckCircle2 className="action-check" size={19} />
                      </div>
                    ))}
                  </div>
                )}

                {duplicateWarning && (
                  <div className="duplicate-warning" role="alert">
                    <CircleAlert size={22} />

                    <div className="duplicate-warning-copy">
                      <strong>Duplicate task detected</strong>
                      <p>{duplicateWarning.message}</p>

                      {duplicateWarning.existingTaskId !== undefined && (
                        <p>
                          Existing task ID: #{duplicateWarning.existingTaskId}
                        </p>
                      )}

                      <p>Do you want to create another copy?</p>

                      <div className="duplicate-warning-actions">
                        <button
                          type="button"
                          className="primary-button"
                          onClick={() => void executePlan(true)}
                          disabled={executing}
                        >
                          {executing ? 'Processing…' : 'Create anyway'}
                        </button>

                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => {
                            setDuplicateWarning(null)
                            setNotice(
                              'Duplicate creation cancelled. No additional copy was requested.',
                            )
                          }}
                          disabled={executing}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                <div className="approval-box">
                  <ShieldCheck size={22} />
                  <div className="approval-copy">
                    <strong>Approval checkpoint</strong>
                    <p>
                      Check the proposed actions before proceeding. This
                      prototype does not send messages or emails.
                    </p>
                    <label className="approval-toggle">
                      <input
                        type="checkbox"
                        checked={approved}
                        onChange={(event) => setApproved(event.target.checked)}
                      />
                      <span>
                        I have reviewed and approve the proposed action.
                      </span>
                    </label>
                  </div>
                </div>

                <button
                  type="button"
                  className="primary-button execute-button"
                  onClick={() => void executePlan()}
                  disabled={executing}
                >
                  {executing ? (
                    <LoaderCircle className="spin" size={17} />
                  ) : (
                    <ArrowRight size={17} />
                  )}
                  {executing ? 'Processing…' : 'Execute workflow'}
                </button>
              </section>
            )}

            <section className="section-heading saved-heading">
              <div>
                <div className="eyebrow">YOUR DATA</div>
                <h2>Saved tasks & reminders</h2>
                <p>Records stored in your ContextWeave database.</p>
              </div>

              <button
                type="button"
                className="secondary-button"
                onClick={() => void refreshAll()}
                disabled={refreshing}
              >
                {refreshing ? (
                  <LoaderCircle className="spin" size={16} />
                ) : (
                  <RefreshCw size={16} />
                )}
                Refresh
              </button>
            </section>

            <div className="saved-grid">
              <section className="saved-card card">
                <div className="saved-card-title">
                  <div className="saved-icon">
                    <ClipboardList size={20} />
                  </div>
                  <div>
                    <h3>Tasks</h3>
                    <span>{tasks.length} saved</span>
                  </div>
                </div>

                {tasks.length === 0 ? (
                  <p className="saved-empty">No saved tasks yet.</p>
                ) : (
                  <div className="saved-list">
                    {tasks.map((task) => (
                      <div className="saved-item" key={task.id}>
                        <div className="saved-item-main">
                          <strong>{task.title}</strong>
                          <span>
                            Task #{task.id} · {task.status ?? 'Saved'}
                          </span>
                          {task.created_at && (
                            <small>Created {formatDate(task.created_at)}</small>
                          )}
                        </div>
                        <CheckCircle2 size={18} />
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="saved-card card">
                <div className="saved-card-title">
                  <div className="saved-icon reminder-icon">
                    <BellRing size={20} />
                  </div>
                  <div>
                    <h3>Reminders</h3>
                    <span>{reminders.length} saved</span>
                  </div>
                </div>

                {reminders.length === 0 ? (
                  <p className="saved-empty">No saved reminders yet.</p>
                ) : (
                  <div className="saved-list">
                    {reminders.map((reminder) => (
                      <div className="saved-item" key={reminder.id}>
                        <div className="saved-item-main">
                          <strong>{reminder.title}</strong>
                          <span>
                            Reminder #{reminder.id} · {reminder.status ?? 'Saved'}
                          </span>
                          <small>
                            {reminder.reminder_time
                              ? `Scheduled ${formatDate(reminder.reminder_time)}`
                              : 'No scheduled time'}
                          </small>
                        </div>
                        <Clock3 size={18} />
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </>
        )}

        {activePage === 'activity' && (
          <>
            <section className="welcome-card">
              <div className="welcome-copy">
                <div className="welcome-tag">
                  <History size={14} />
                  WORKFLOW HISTORY
                </div>
                <h2>See what happened.</h2>
                <p>
                  Review action results and statuses recorded by your backend.
                </p>
              </div>
              <div className="welcome-art">
                <Activity size={76} strokeWidth={1.2} />
              </div>
            </section>

            <section className="section-heading">
              <div>
                <div className="eyebrow">RECENT EVENTS</div>
                <h2>Action history</h2>
                <p>{history.length} recorded actions</p>
              </div>

              <button
                type="button"
                className="secondary-button"
                onClick={() => void refreshHistory()}
                disabled={refreshing}
              >
                {refreshing ? (
                  <LoaderCircle className="spin" size={16} />
                ) : (
                  <RefreshCw size={16} />
                )}
                Refresh
              </button>
            </section>

            <section className="saved-card card activity-card">
              {history.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">
                    <History size={27} />
                  </div>
                  <strong>No activity recorded yet</strong>
                  <p>
                    Execute a workflow and refresh this page to see recorded
                    actions.
                  </p>
                </div>
              ) : (
                <div className="saved-list">
                  {history.map((item) => (
                    <div className="saved-item history-item" key={item.id}>
                      <div className="saved-icon">
                        <Activity size={19} />
                      </div>
                      <div className="saved-item-main">
                        <strong>{item.description || 'Workflow action'}</strong>
                        <span>
                          {(item.action_type || 'Action').toUpperCase()}
                          {' · '}
                          {item.status || 'Unknown'}
                          {' · ID '}
                          {item.id}
                        </span>
                        {item.result && <small>{item.result}</small>}
                        {item.created_at && (
                          <small>{formatDate(item.created_at)}</small>
                        )}
                      </div>
                      <span className="history-status">
                        {item.status || 'Unknown'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}

        {activePage === 'actionguard' && (
          <>
            <section className="welcome-card">
              <div className="welcome-copy">
                <div className="welcome-tag">
                  <ShieldCheck size={14} />
                  ACTIONGUARD
                </div>
                <h2>Your actions.<br />Your permission.</h2>
                <p>
                  Review proposed actions and understand the safeguards in
                  this prototype.
                </p>
              </div>
              <div className="welcome-art">
                <LockKeyhole size={76} strokeWidth={1.2} />
              </div>
            </section>

            <section className="section-heading">
              <div>
                <div className="eyebrow">SAFETY & CONTROL</div>
                <h2>Approval safeguards</h2>
              </div>
            </section>

            <div className="saved-grid">
              <section className="saved-card card">
                <div className="saved-card-title">
                  <div className="saved-icon">
                    <ShieldCheck size={20} />
                  </div>
                  <div>
                    <h3>Review before execution</h3>
                    <span>Human oversight</span>
                  </div>
                </div>
                <p className="guard-description">
                  Review proposed actions before approving them. Only approve
                  actions you want the application to attempt.
                </p>
              </section>

              <section className="saved-card card">
                <div className="saved-card-title">
                  <div className="saved-icon reminder-icon">
                    <LockKeyhole size={20} />
                  </div>
                  <div>
                    <h3>External actions</h3>
                    <span>Prototype limitations</span>
                  </div>
                </div>
                <p className="guard-description">
                  This prototype does not send messages or emails. External
                  delivery requires a connected provider and its own
                  implementation.
                </p>
              </section>

              <section className="saved-card card">
                <div className="saved-card-title">
                  <div className="saved-icon reminder-icon">
                    <CalendarClock size={20} />
                  </div>
                  <div>
                    <h3>Reminder handling</h3>
                    <span>Saved in the database</span>
                  </div>
                </div>
                <p className="guard-description">
                  Reminder dates and times can be stored in the database.
                  Automatic notifications are not implemented yet.
                </p>
              </section>

              <section className="saved-card card">
                <div className="saved-card-title">
                  <div className="saved-icon">
                    <ClipboardList size={20} />
                  </div>
                  <div>
                    <h3>Action records</h3>
                    <span>Traceability</span>
                  </div>
                </div>
                <p className="guard-description">
                  Open Activity to inspect recorded action statuses and
                  results from your backend.
                </p>
                <button
                  type="button"
                  className="primary-button guard-button"
                  onClick={() => navigate('activity')}
                >
                  View activity <ArrowRight size={16} />
                </button>
              </section>
            </div>
          </>
        )}

        <footer className="page-footer">
          <span>ContextWeave · Hackathon prototype</span>
          <span>
            <ShieldCheck size={14} />
            Designed for review and control
          </span>
        </footer>
      </section>
    </main>
  )
}

export default App
