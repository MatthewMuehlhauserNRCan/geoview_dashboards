// const CGPV_SCRIPT_URL = 'https://canadian-geospatial-platform.github.io/geoview/public/cgpv-main.js';
const CGPV_SCRIPT_URL = 'https://matthewmuehlhausernrcan.github.io/geoview/cgpv-main.js';

let cgpvPromise: Promise<void> | undefined;

// Loads the GeoView bundle exactly once, no matter how many map panels mount.
export function loadCgpv(): Promise<void> {
  if (window.cgpv) return Promise.resolve();

  if (!cgpvPromise) {
    cgpvPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = CGPV_SCRIPT_URL;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load GeoView (cgpv-main.js)'));
      document.head.appendChild(script);
    });
  }

  return cgpvPromise;
}
