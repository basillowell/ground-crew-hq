import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';
import { LEAFLET_ATTRIBUTION, OPEN_STREET_MAP_TILE_URL } from '@/lib/integrations';

const propertyMarkerIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

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
  return (
    <MapContainer center={center} zoom={15} scrollWheelZoom={false} className="h-56 w-full rounded-2xl">
      <TileLayer attribution={LEAFLET_ATTRIBUTION} url={OPEN_STREET_MAP_TILE_URL} />
      <Marker position={center} icon={propertyMarkerIcon}>
        <Popup>
          <div className="text-sm font-medium">{propertyName}</div>
          {workLocation ? <div className="text-xs text-muted-foreground">{workLocation}</div> : null}
        </Popup>
      </Marker>
      {crewMarkers.map((marker) => (
        <Marker key={marker.id} position={[marker.latitude, marker.longitude]} icon={propertyMarkerIcon}>
          <Popup>
            <div className="text-sm font-medium">{marker.name}</div>
            <div className="text-xs text-muted-foreground">Active in field</div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
