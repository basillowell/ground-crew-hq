export function RadarEmbed({ latitude, longitude }: { latitude: number; longitude: number }) {
  const src = `https://www.rainviewer.com/map.html?loc=${latitude},${longitude},8&oFa=1&oC=1&oU=1&oCS=1&oF=0&oAP=1&c=1&o=83&lm=1&layer=radar&sm=1&sn=1`;

  return (
    <div className="relative w-full overflow-hidden rounded-xl border" style={{ height: "400px" }}>
      <iframe
        src={src}
        width="100%"
        height="100%"
        frameBorder="0"
        style={{ border: 0 }}
        allowFullScreen
        loading="lazy"
        title="Live Weather Radar"
      />
    </div>
  );
}
