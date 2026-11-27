import { ShieldAlert } from 'lucide-react'
import { CONSTRUCTION_WEATHER_GUIDANCE } from '../../data/weatherGuidance'
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui'

export function ConstructionWeatherGuide() {
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Construction Weather Considerations</CardTitle>
          <CardDescription>
            Transparent activity sensitivity reference for outdoor civil engineering tasks.
          </CardDescription>
        </div>
        <Badge variant="warning">Advisory Reference Only</Badge>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
          {CONSTRUCTION_WEATHER_GUIDANCE.map((item) => (
            <div
              key={item.activity}
              className="flex flex-col justify-between rounded-sm border border-border-neutral bg-ivory/50 p-3.5"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-editorial-blue">{item.activity}</h3>
                  <Badge variant={item.rainfallSensitivity === 'High' ? 'critical' : 'warning'}>
                    {item.rainfallSensitivity}
                  </Badge>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-charcoal/85">
                  {item.rainTriggerNote}
                </p>
              </div>
              <p className="mt-3 border-t border-border-neutral pt-2 text-[11px] font-medium text-editorial-blue">
                {item.advisoryAction}
              </p>
            </div>
          ))}
        </div>

        <div className="flex items-start gap-2.5 rounded-sm border border-border-neutral bg-sand/55 p-3 text-xs text-charcoal">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-coral" aria-hidden="true" />
          <p>
            <strong className="text-editorial-blue">Disclaimer:</strong> These rules summarize
            general outdoor rainfall sensitivities. They are <strong>not</strong> engineering-certified
            site safety sign-offs, and live Open-Meteo rainfall is <strong>not</strong> an input to
            the XGBoost ML duration model.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
