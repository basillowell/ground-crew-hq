import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Bell, BellOff, AlertTriangle, AlertCircle, Info, Settings, ChevronRight, Zap } from 'lucide-react';
import { escalationRules, type EscalationRule } from '@/data/multiPropertyData';

const severityConfig = {
  critical: { icon: AlertCircle, color: 'text-destructive', bg: 'bg-destructive/10 border-destructive/20', badge: 'destructive' as const },
  warning: { icon: AlertTriangle, color: 'text-warning', bg: 'bg-amber-50 border-amber-200', badge: 'outline' as const },
  info: { icon: Info, color: 'text-info', bg: 'bg-blue-50 border-blue-200', badge: 'secondary' as const },
};

interface LiveAlert {
  id: string;
  ruleId: string;
  message: string;
  severity: 'critical' | 'warning' | 'info';
  timestamp: string;
  propertyName: string;
  dismissed: boolean;
}

const sampleAlerts: LiveAlert[] = [
  { id: 'la-1', ruleId: 'esc-5', message: '3 crew members are scheduled but unassigned', severity: 'critical', timestamp: '7:15 AM', propertyName: 'Ground Crew HQ', dismissed: false },
  { id: 'la-2', ruleId: 'esc-2', message: 'Toro Mower #T-003 is overdue for service by 42h', severity: 'critical', timestamp: '6:45 AM', propertyName: 'Ground Crew HQ', dismissed: false },
  { id: 'la-3', ruleId: 'esc-3', message: 'Rain expected — review spray operations for Pine Valley Club', severity: 'warning', timestamp: '6:30 AM', propertyName: 'Pine Valley Club', dismissed: false },
  { id: 'la-4', ruleId: 'esc-1', message: '2 crew members need shifts for tomorrow', severity: 'warning', timestamp: '5:00 PM', propertyName: 'Oceanview Resort', dismissed: false },
];

export function EscalationCenter({ onNavigate }: { onNavigate?: (route: string) => void }) {
  const [rules, setRules] = useState(escalationRules);
  const [alerts, setAlerts] = useState(sampleAlerts);
  const [showRules, setShowRules] = useState(false);

  function toggleRule(id: string) {
    setRules((prev) => prev.map((r) => r.id === id ? { ...r, isActive: !r.isActive } : r));
  }

  function dismissAlert(id: string) {
    setAlerts((prev) => prev.map((a) => a.id === id ? { ...a, dismissed: true } : a));
  }

  const activeAlerts = alerts.filter((a) => !a.dismissed);
  const criticalCount = activeAlerts.filter((a) => a.severity === 'critical').length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <Zap className="h-4 w-4 text-warning" />
            Escalation Center
          </h3>
          {criticalCount > 0 && (
            <Badge variant="destructive" className="text-[10px] animate-pulse">
              {criticalCount} critical
            </Badge>
          )}
        </div>
        <Button variant="ghost" size="sm" className="text-xs" onClick={() => setShowRules(!showRules)}>
          <Settings className="h-3.5 w-3.5 mr-1" />
          {showRules ? 'View Alerts' : 'Manage Rules'}
        </Button>
      </div>

      {!showRules ? (
        <div className="space-y-2">
          {activeAlerts.length === 0 ? (
            <Card className="p-6 text-center">
              <BellOff className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">All clear — no active alerts</p>
            </Card>
          ) : (
            activeAlerts.map((alert) => {
              const config = severityConfig[alert.severity];
              const Icon = config.icon;
              return (
                <Card key={alert.id} className={`p-3 border ${config.bg} transition-all`}>
                  <div className="flex items-start gap-3">
                    <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${config.color}`} />
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium">{alert.message}</p>
                        <Badge variant={config.badge} className="text-[10px] shrink-0">{alert.severity}</Badge>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                        <span>{alert.propertyName}</span>
                        <span>·</span>
                        <span>{alert.timestamp}</span>
                      </div>
                      <div className="flex items-center gap-2 pt-1">
                        <Button size="sm" variant="outline" className="h-6 text-[10px] px-2" onClick={() => dismissAlert(alert.id)}>
                          Dismiss
                        </Button>
                        <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2" onClick={() => onNavigate?.('/app/workboard')}>
                          View <ChevronRight className="h-3 w-3 ml-0.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {rules.map((rule) => {
            const config = severityConfig[rule.severity];
            return (
              <Card key={rule.id} className="p-3 flex items-center gap-3">
                <Switch checked={rule.isActive} onCheckedChange={() => toggleRule(rule.id)} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{rule.message.replace('{count}', '#').replace('{unit}', '...').replace('{hours}', '..').replace('{property}', '...')}</div>
                  <div className="text-[11px] text-muted-foreground">{rule.condition} · Notify: {rule.notifyRoles.join(', ')}</div>
                </div>
                <Badge variant={config.badge} className="text-[10px]">{rule.severity}</Badge>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
