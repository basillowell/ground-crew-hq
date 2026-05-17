import { MapPin } from "lucide-react";

type CrewMarker = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
};

type MobileFieldMapProps = {
  center: [number, number];
  propertyName: string;
  workLocation?: string;
  crewMarkers: CrewMarker[];
};

export function MobileFieldMap({ center, propertyName, workLocation, crewMarkers }: MobileFieldMapProps) {
  const [latitude, longitude] = center;
  const embedSrc = `https://www.google.com/maps?q=${latitude},${longitude}&z=15&output=embed`;

  return (
    <div className="overflow-hidden rounded-2xl border bg-card">
      <iframe
        title="Field map"
        src={embedSrc}
        className="h-56 w-full"
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />
      <div className="space-y-2 border-t p-3">
        <div className="text-sm font-medium">{propertyName}</div>
        {workLocation ? <div className="text-xs text-muted-foreground">{workLocation}</div> : null}
        {crewMarkers.length > 0 ? (
          <div className="space-y-1">
            {crewMarkers.map((marker) => (
              <div key={marker.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                <MapPin className="h-3.5 w-3.5" />
                <span>{marker.name}</span>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
