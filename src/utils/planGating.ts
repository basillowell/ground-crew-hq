export function isPro(subscriptionStatus: string | null): boolean {
  return subscriptionStatus === 'active';
}

export function requiresPro(feature: string): boolean {
  const proFeatures = [
    'csv-export',
    'cost-reports',
    'multi-property',
    'schedule-templates',
    'whatsapp-share',
    'ai-briefing',
  ];
  return proFeatures.includes(feature);
}
