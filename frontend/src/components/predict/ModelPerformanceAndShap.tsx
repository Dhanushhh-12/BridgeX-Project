import { Cpu, Info, Sparkles } from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  GLOBAL_SHAP_IMPORTANCE,
  MODEL_EVALUATION,
  SHAP_BASELINE_DAYS,
} from '../../data/mlModelMetadata'
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui'

const EVAL_CHART_DATA = [
  { metric: 'MAE (days)', value: MODEL_EVALUATION.metrics.maeDays, fill: '#183153' },
  { metric: 'RMSE (days)', value: MODEL_EVALUATION.metrics.rmseDays, fill: '#F0785F' },
]

export function ModelPerformanceAndShap() {
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      {/* Real Model Evaluation Metrics */}
      <Card className="flex flex-col">
        <CardHeader>
          <div>
            <CardTitle>Model Information &amp; Test-Set Evaluation</CardTitle>
            <CardDescription>
              Verified against saved <code>{MODEL_EVALUATION.modelPath}</code> on{' '}
              {MODEL_EVALUATION.testRecords.toLocaleString()} held-out test rows (20% split).
            </CardDescription>
          </div>
          <Badge variant="info" showDot>
            Verified Metrics
          </Badge>
        </CardHeader>

        <CardContent className="flex-1 space-y-4">
          <div className="rounded-sm border border-border-neutral bg-ivory/60 p-3.5 text-xs space-y-1">
            <p className="inline-flex items-center gap-1.5 font-semibold text-editorial-blue">
              <Cpu className="h-3.5 w-3.5 text-coral" aria-hidden="true" />
              {MODEL_EVALUATION.algorithm}
            </p>
            <p className="font-mono text-[11px] text-charcoal/85">
              {MODEL_EVALUATION.hyperparameters.nEstimators} trees · max_depth=
              {MODEL_EVALUATION.hyperparameters.maxDepth} · learning_rate=
              {MODEL_EVALUATION.hyperparameters.learningRate} · Trained on{' '}
              {MODEL_EVALUATION.trainRecords.toLocaleString()} /{' '}
              {MODEL_EVALUATION.totalRecords.toLocaleString()} synthetic tasks
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-sm border border-border-neutral bg-surface p-3">
              <p className="bx-label">MAE</p>
              <p className="mt-1 text-xl font-semibold text-editorial-blue bx-tabular">
                {MODEL_EVALUATION.metrics.maeDays.toFixed(4)}d
              </p>
              <p className="mt-0.5 text-[11px] text-charcoal/75">Average error</p>
            </div>
            <div className="rounded-sm border border-border-neutral bg-surface p-3">
              <p className="bx-label">RMSE</p>
              <p className="mt-1 text-xl font-semibold text-editorial-blue bx-tabular">
                {MODEL_EVALUATION.metrics.rmseDays.toFixed(4)}d
              </p>
              <p className="mt-0.5 text-[11px] text-charcoal/75">Typical error</p>
            </div>
            <div className="rounded-sm border border-border-neutral bg-surface p-3">
              <p className="bx-label">R² Score</p>
              <p className="mt-1 text-xl font-semibold text-editorial-blue bx-tabular">
                {MODEL_EVALUATION.metrics.r2Score.toFixed(4)}
              </p>
              <p className="mt-0.5 text-[11px] text-charcoal/75">
                {MODEL_EVALUATION.metrics.r2Percent}% variance explained
              </p>
            </div>
          </div>

          <div className="h-[175px] w-full" aria-label="Model MAE and RMSE error comparison chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={EVAL_CHART_DATA}
                layout="vertical"
                margin={{ top: 6, right: 24, left: 16, bottom: 6 }}
              >
                <CartesianGrid stroke="#DED7CB" strokeDasharray="3 3" horizontal={false} />
                <XAxis
                  type="number"
                  domain={[0, 2]}
                  unit="d"
                  tick={{ fill: '#292D32', fontSize: 11 }}
                  axisLine={{ stroke: '#DED7CB' }}
                />
                <YAxis
                  type="category"
                  dataKey="metric"
                  width={90}
                  tick={{ fill: '#183153', fontSize: 12, fontWeight: 600 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  formatter={(v) => [`${v ?? 0} days`, 'Test Error']}
                  contentStyle={{
                    backgroundColor: '#FFFFFF',
                    borderColor: '#DED7CB',
                    borderRadius: '4px',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="value" barSize={24} radius={[0, 2, 2, 0]}>
                  {EVAL_CHART_DATA.map((entry) => (
                    <Cell key={entry.metric} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="rounded-sm border border-border-neutral bg-sand/50 p-3 text-xs leading-relaxed text-charcoal">
            <strong className="text-editorial-blue">Beginner Guide to Metrics:</strong> On held-out
            synthetic test records, predictions are off by about <strong>1.01 days</strong> on
            average (MAE), with typical squared-error deviation of <strong>1.28 days</strong>{' '}
            (RMSE). An R² of <strong>0.9744</strong> means the model explains 97.44% of duration
            variation in the training dataset—not real-world accuracy on unseen job sites.
          </div>
        </CardContent>
      </Card>

      {/* Real Global SHAP Explainability from explain.py */}
      <Card className="flex flex-col">
        <CardHeader>
          <div>
            <CardTitle>SHAP Feature Importance (explain.py)</CardTitle>
            <CardDescription>
              Global mean |SHAP| impact in days across 1,000 sample tasks (baseline:{' '}
              <strong>{SHAP_BASELINE_DAYS} days</strong>).
            </CardDescription>
          </div>
          <Badge variant="info" showDot>
            SHAP TreeExplainer
          </Badge>
        </CardHeader>

        <CardContent className="flex-1 space-y-4">
          <div className="h-[240px] w-full" aria-label="Global SHAP feature importance chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={GLOBAL_SHAP_IMPORTANCE}
                layout="vertical"
                margin={{ top: 4, right: 24, left: 20, bottom: 4 }}
              >
                <CartesianGrid stroke="#DED7CB" strokeDasharray="3 3" horizontal={false} />
                <XAxis
                  type="number"
                  unit="d"
                  tick={{ fill: '#292D32', fontSize: 11 }}
                  axisLine={{ stroke: '#DED7CB' }}
                />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={130}
                  tick={{ fill: '#183153', fontSize: 11, fontWeight: 500 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  formatter={(v) => [`± ${Number(v ?? 0).toFixed(2)} days`, 'Avg |SHAP| Impact']}
                  contentStyle={{
                    backgroundColor: '#FFFFFF',
                    borderColor: '#DED7CB',
                    borderRadius: '4px',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="meanAbsShapDays" fill="#183153" radius={[0, 2, 2, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <ul className="space-y-1.5 text-xs text-charcoal/85">
            {GLOBAL_SHAP_IMPORTANCE.slice(0, 3).map((item) => (
              <li key={item.feature} className="flex items-start gap-2">
                <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-coral" aria-hidden="true" />
                <span>
                  <strong className="text-editorial-blue">{item.label}</strong> (±{' '}
                  {item.meanAbsShapDays.toFixed(2)}d): {item.explanation}
                </span>
              </li>
            ))}
          </ul>

          <div className="flex items-start gap-2 rounded-sm border border-border-neutral bg-sand/50 p-3 text-xs text-charcoal">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-editorial-blue" aria-hidden="true" />
            <p>
              <strong className="text-editorial-blue">Explainability Limitation:</strong> Chart
              above uses verified global values from <code>explain.py</code>. Per-request individual
              SHAP waterfall values for custom form submissions are not yet returned by{' '}
              <code>POST /predict</code> and are not fabricated here.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
