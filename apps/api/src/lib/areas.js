// Bangalore neighbourhood centroids (real coordinates), used for seeding and as a geocode fallback.
export const BANGALORE_CENTER = { lat: 12.9716, lng: 77.5946 };

export const AREAS = {
  Indiranagar: { lat: 12.9719, lng: 77.6412, pincode: '560038' },
  Koramangala: { lat: 12.9352, lng: 77.6245, pincode: '560034' },
  'HSR Layout': { lat: 12.9116, lng: 77.6474, pincode: '560102' },
  Whitefield: { lat: 12.9698, lng: 77.75, pincode: '560066' },
  Jayanagar: { lat: 12.9308, lng: 77.5838, pincode: '560041' },
  'JP Nagar': { lat: 12.9063, lng: 77.5857, pincode: '560078' },
  Malleshwaram: { lat: 13.0035, lng: 77.571, pincode: '560003' },
  'BTM Layout': { lat: 12.9166, lng: 77.6101, pincode: '560076' },
  Bellandur: { lat: 12.9257, lng: 77.6764, pincode: '560103' },
  Hebbal: { lat: 13.0358, lng: 77.597, pincode: '560024' },
};

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z]/g, '');

/** Best-effort centroid for an area name, falling back to the city centre. */
export function areaCentroid(area) {
  const key = Object.keys(AREAS).find((k) => norm(k) === norm(area) || (norm(area) && norm(area).includes(norm(k))));
  return key ? { lat: AREAS[key].lat, lng: AREAS[key].lng } : { ...BANGALORE_CENTER };
}
