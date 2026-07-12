// Thin wrapper around the browser Geolocation API. Used in three
// places: capturing a precise address at booking time, staff check-in
// (on-my-way / arrived), and the SOS emergency button.
//
// Deliberately NOT continuous tracking — each of these is a single
// snapshot at a specific moment, not an ongoing location stream. A
// full live-tracking feature is a much bigger, more invasive thing
// this app doesn't attempt; a timestamped position at the moments
// that actually matter (leaving, arriving, an emergency) is what
// gives real safety value without asking for constant background
// location access.

export function isGeolocationSupported() {
  return typeof navigator !== 'undefined' && 'geolocation' in navigator;
}

// Resolves { lat, lng, accuracy } or rejects with a human-readable
// message. enableHighAccuracy is on for SOS/check-in (worth the extra
// second for a precise fix in an emergency) and off for the booking
// widget (approximate is fine for "which street/area", faster, less
// battery).
export function getCurrentLocation({ highAccuracy = false, timeoutMs = 10000 } = {}) {
  return new Promise((resolve, reject) => {
    if (!isGeolocationSupported()) {
      reject(new Error('Location is not supported on this device/browser.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
      }),
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          reject(new Error('Location permission denied. Enable it in your browser/phone settings.'));
        } else if (err.code === err.TIMEOUT) {
          reject(new Error('Could not get a location fix in time. Try again, ideally outdoors or near a window.'));
        } else {
          reject(new Error('Could not get your location. Try again.'));
        }
      },
      { enableHighAccuracy: highAccuracy, timeout: timeoutMs, maximumAge: 0 }
    );
  });
}

export function mapsUrl(lat, lng) {
  if (lat == null || lng == null) return null;
  return `https://maps.google.com/?q=${lat},${lng}`;
}
