import { useMemo, useState } from 'react'
import { HelpCircle, Info, SlidersHorizontal } from 'lucide-react'
import { PageHeader } from '../components/layout'
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  EmptyState,
  ErrorState,
  Input,
  LoadingIndicator,
  Modal,
  SearchField,
  Select,
  SkeletonBlock,
  Table,
  Tabs,
  Tooltip,
  type SortDirection,
  type TableColumn,
} from '../components/ui'

interface ColorTokenSpec {
  id: string
  name: string
  hex: string
  cssVar: string
  ratio: string
  usage: string
}

const COLOR_SPECS: ColorTokenSpec[] = [
  { id: 'ivory', name: 'Warm Ivory', hex: '#F5F0E6', cssVar: '--bx-ivory', ratio: '65%', usage: 'Main application background' },
  { id: 'blue', name: 'Deep Editorial Blue', hex: '#183153', cssVar: '--bx-blue', ratio: '25%', usage: 'Navigation, headings, headers' },
  { id: 'coral', name: 'Coral Orange', hex: '#F0785F', cssVar: '--bx-coral', ratio: '10%', usage: 'Primary actions & critical indicators' },
  { id: 'sand', name: 'Soft Sand', hex: '#E8DFD0', cssVar: '--bx-sand', ratio: 'Support', usage: 'Secondary bands & table headers' },
  { id: 'charcoal', name: 'Charcoal', hex: '#292D32', cssVar: '--bx-charcoal', ratio: 'Support', usage: 'Primary body typography' },
  { id: 'sage', name: 'Muted Sage', hex: '#8B9B91', cssVar: '--bx-sage', ratio: 'Support', usage: 'Secondary dots & quiet indicators' },
  { id: 'white', name: 'White', hex: '#FFFFFF', cssVar: '--bx-white', ratio: 'Support', usage: 'Elevated card surfaces' },
  { id: 'border', name: 'Border', hex: '#DED7CB', cssVar: '--bx-border', ratio: 'Support', usage: '1px structural hairline borders' },
]

const TOKEN_FILTER_OPTIONS = [
  { value: 'all', label: 'All Token Categories' },
  { value: 'primary', label: 'Primary (65 / 25 / 10)' },
  { value: 'support', label: 'Supporting Neutrals' },
]

export function DesignSystemPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [inputDemo, setInputDemo] = useState('')
  const [sortKey, setSortKey] = useState<string>('name')
  const [sortDir, setSortDir] = useState<SortDirection>('asc')
  const [modalOpen, setModalOpen] = useState(false)
  const [statePreview, setStatePreview] = useState<'ready' | 'loading' | 'empty' | 'error'>('ready')

  function handleSortChange(nextKey: string) {
    if (sortKey === nextKey) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(nextKey)
      setSortDir('asc')
    }
  }

  const filteredTokens = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    const list = COLOR_SPECS.filter((item) => {
      const matchesFilter =
        categoryFilter === 'all' ||
        (categoryFilter === 'primary' ? item.ratio !== 'Support' : item.ratio === 'Support')
      const matchesSearch =
        !q ||
        item.name.toLowerCase().includes(q) ||
        item.hex.toLowerCase().includes(q) ||
        item.usage.toLowerCase().includes(q)
      return matchesFilter && matchesSearch
    })

    return [...list].sort((a, b) => {
      const aVal = sortKey === 'hex' ? a.hex : sortKey === 'ratio' ? a.ratio : a.name
      const bVal = sortKey === 'hex' ? b.hex : sortKey === 'ratio' ? b.ratio : b.name
      return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
    })
  }, [categoryFilter, searchQuery, sortDir, sortKey])

  const columns: TableColumn<ColorTokenSpec>[] = [
    {
      key: 'name',
      header: 'Token Name',
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-2.5">
          <span
            className="h-4 w-4 shrink-0 rounded-xs border border-border-neutral"
            style={{ backgroundColor: row.hex }}
            aria-hidden="true"
          />
          <span className="font-semibold text-editorial-blue">{row.name}</span>
        </div>
      ),
    },
    { key: 'hex', header: 'Hex Value', sortable: true, render: (row) => <code className="font-mono text-xs">{row.hex}</code> },
    { key: 'cssVar', header: 'CSS Variable', render: (row) => <code className="font-mono text-xs text-editorial-blue">{row.cssVar}</code> },
    { key: 'ratio', header: 'Distribution', sortable: true, render: (row) => <Badge variant={row.ratio === 'Support' ? 'neutral' : 'info'}>{row.ratio}</Badge> },
    { key: 'usage', header: 'Design Role', render: (row) => <span className="text-xs text-charcoal/85">{row.usage}</span> },
  ]

  const tabItems = [
    {
      id: 'controls',
      label: 'Inputs & Actions',
      badge: 5,
      content: (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Buttons &amp; Tooltips</CardTitle>
                <CardDescription>Accessible contrast across Coral Orange, Deep Blue, and outline controls.</CardDescription>
              </div>
              <Tooltip content="Focus or hover any control to inspect keyboard-accessible feedback.">
                <button
                  type="button"
                  aria-label="Design system accessibility note"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-sm border border-border-neutral text-editorial-blue hover:bg-sand"
                >
                  <HelpCircle className="h-4 w-4" aria-hidden="true" />
                </button>
              </Tooltip>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2.5">
                <Button variant="primary">Primary Action</Button>
                <Button variant="secondary">Secondary Blue</Button>
                <Button variant="outline">Outline</Button>
                <Button variant="ghost">Ghost</Button>
                <Button variant="danger">Critical Alert</Button>
              </div>
              <div className="flex flex-wrap items-center gap-2.5">
                <Button size="sm" variant="secondary">Small</Button>
                <Button size="md" variant="primary" isLoading>Processing</Button>
                <Button size="lg" variant="outline" onClick={() => setModalOpen(true)}>Open Modal Dialog</Button>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <Badge variant="neutral" showDot>Neutral</Badge>
                <Badge variant="info" showDot>Active Module</Badge>
                <Badge variant="success" showDot>Verified</Badge>
                <Badge variant="warning" showDot>Review Required</Badge>
                <Badge variant="critical" showDot>Action Needed</Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div>
                <CardTitle>Form Controls</CardTitle>
                <CardDescription>Inputs, Search, and Selects with accessible labels and validation states.</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                label="Standard Field"
                placeholder="Enter configuration identifier"
                value={inputDemo}
                onChange={(e) => setInputDemo(e.target.value)}
                helperText="Supports clear helper guidance and error validation."
                required
              />
              <Input
                label="Validation Error Example"
                defaultValue="invalid_entry"
                error="Example validation message styled with Coral Orange indicator."
              />
              <Select
                label="Select Dropdown"
                options={TOKEN_FILTER_OPTIONS}
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                helperText="Native accessible select styled with Bridge X borders."
              />
            </CardContent>
          </Card>
        </div>
      ),
    },
    {
      id: 'typography',
      label: 'Typography Scale',
      content: (
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Editorial Typography Hierarchy</CardTitle>
              <CardDescription>Defined in <code>src/styles/design-tokens.css</code>.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-5 divide-y divide-border-neutral">
            <div className="pt-1">
              <p className="bx-label">Page Heading (.bx-heading-page)</p>
              <p className="bx-heading-page mt-1">Infrastructure Progress Overview</p>
            </div>
            <div className="pt-4">
              <p className="bx-label">Section Heading (.bx-heading-section)</p>
              <p className="bx-heading-section mt-1">Delay Prediction &amp; Weather Correlation</p>
            </div>
            <div className="pt-4">
              <p className="bx-label">Card Heading (.bx-heading-card)</p>
              <p className="bx-heading-card mt-1">Component Calibration &amp; Surface Tokens</p>
            </div>
            <div className="pt-4">
              <p className="bx-label">Body Copy (.bx-body)</p>
              <p className="bx-body mt-1 max-w-2xl">
                Readable 15px Charcoal typography on Warm Ivory and White surfaces with tabular numbers (<code>1,240.50 days</code>).
              </p>
            </div>
          </CardContent>
        </Card>
      ),
    },
    {
      id: 'states',
      label: 'System States',
      content: (
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Loading, Empty &amp; Error States</CardTitle>
              <CardDescription>Toggle feedback states designed for live API operations.</CardDescription>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(['ready', 'loading', 'empty', 'error'] as const).map((mode) => (
                <Button key={mode} size="sm" variant={statePreview === mode ? 'secondary' : 'outline'} onClick={() => setStatePreview(mode)}>
                  {mode}
                </Button>
              ))}
            </div>
          </CardHeader>
          <CardContent>
            {statePreview === 'ready' && (
              <div className="flex items-start gap-3 rounded-sm border border-border-neutral bg-ivory/60 p-4">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-editorial-blue" aria-hidden="true" />
                <div className="text-sm">
                  <p className="font-semibold text-editorial-blue">All UI States Verified</p>
                  <p className="text-xs text-charcoal/80">Use the toggle buttons above to preview Loading, Empty, and Error components.</p>
                </div>
              </div>
            )}
            {statePreview === 'loading' && (
              <div className="space-y-4">
                <LoadingIndicator label="Verifying loading spinner..." />
                <div className="grid gap-3 sm:grid-cols-3">
                  <SkeletonBlock className="h-14" />
                  <SkeletonBlock className="h-14" />
                  <SkeletonBlock className="h-14" />
                </div>
              </div>
            )}
            {statePreview === 'empty' && (
              <EmptyState
                title="No Matching Items Found"
                description="Reusable empty state ready for filtered tables, reports, or search results."
                action={<Button size="sm" variant="outline" onClick={() => setStatePreview('ready')}>Reset Preview</Button>}
              />
            )}
            {statePreview === 'error' && (
              <ErrorState
                title="Service Connection Notice"
                message="Reusable accessible error state with optional retry control."
                action={<Button size="sm" variant="primary" onClick={() => setStatePreview('ready')}>Retry Check</Button>}
              />
            )}
          </CardContent>
        </Card>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Step 14.3 Reference"
        title="Editorial Design System"
        description="Reusable, accessible React + TypeScript primitives built on 65% Warm Ivory, 25% Deep Editorial Blue, and 10% Coral Orange."
        breadcrumbs={[{ label: 'Settings', to: '/settings' }, { label: 'Design System' }]}
        actions={
          <Button variant="primary" leftIcon={<SlidersHorizontal className="h-4 w-4" />} onClick={() => setModalOpen(true)}>
            Inspect Token Summary
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Color Token Registry</CardTitle>
            <CardDescription>Interactive verification of Search, Select, Badge, and Table primitives.</CardDescription>
          </div>
          <div className="grid w-full gap-3 sm:w-auto sm:grid-cols-2">
            <SearchField value={searchQuery} onValueChange={setSearchQuery} placeholder="Filter tokens or hex..." aria-label="Filter design tokens" />
            <Select options={TOKEN_FILTER_OPTIONS} value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} aria-label="Filter token category" />
          </div>
        </CardHeader>
        <CardContent>
          <Table
            caption="AI Bridge X design system color tokens"
            columns={columns}
            data={filteredTokens}
            rowKey={(row) => row.id}
            sortKey={sortKey}
            sortDirection={sortDir}
            onSortChange={handleSortChange}
            emptyTitle="No matching design tokens"
            emptyDescription="Clear the search filter or choose All Token Categories."
          />
        </CardContent>
        <CardFooter className="justify-between">
          <span className="text-xs text-charcoal/75">Showing {filteredTokens.length} of {COLOR_SPECS.length} registered color tokens</span>
          {(searchQuery || categoryFilter !== 'all') && (
            <Button size="sm" variant="outline" onClick={() => { setSearchQuery(''); setCategoryFilter('all') }}>Reset Filters</Button>
          )}
        </CardFooter>
      </Card>

      <Tabs items={tabItems} ariaLabel="Design system component groups" />

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Editorial Design System Specification"
        description="Verified accessibility and layout tokens for AI Bridge X."
        footer={
          <>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Close</Button>
            <Button variant="primary" onClick={() => setModalOpen(false)}>Confirm Verified</Button>
          </>
        }
      >
        <div className="space-y-3 text-sm leading-relaxed text-charcoal">
          <p>
            Every UI control uses crisp <code>2px–4px</code> corners, <code>1px solid #DED7CB</code> hairline borders,
            visible Deep Editorial Blue focus rings, and system-native <code>prefers-reduced-motion</code> support.
          </p>
        </div>
      </Modal>
    </div>
  )
}
