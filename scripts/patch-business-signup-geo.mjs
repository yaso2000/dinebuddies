import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.join(__dirname, '..', 'src', 'pages', 'BusinessSignup.jsx');

let s = fs.readFileSync(filePath, 'utf8');

const markerStart = '    // Auto-detect user location (same as CreateInvitation)';
const markerEnd = '    const handleLocationSelect';

const i0 = s.indexOf(markerStart);
const i1 = s.indexOf(markerEnd);
if (i0 === -1 || i1 === -1) {
    console.error('markers not found', { i0, i1 });
    process.exit(1);
}

const newBlock = `    // Auto-detect user location (GPS + BigDataCloud; apply country even if city field is empty)
    useEffect(() => {
        if (!navigator.geolocation) return;
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude } = position.coords;

                setFormData((prev) => ({
                    ...prev,
                    userLat: latitude,
                    userLng: longitude,
                }));

                try {
                    const response = await fetch(
                        \`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=\${latitude}&longitude=\${longitude}&localityLanguage=en\`
                    );

                    if (!response.ok) throw new Error('Geocoding failed');

                    const data = await response.json();
                    if (!data) return;

                    const detectedCity = cityFromBigDataCloudReverseClient(data);
                    setFormData((prev) => {
                        const code = countryCodeFromBigDataCloudReverseClient(data, prev.country || 'AU');
                        const next = { ...prev, country: code || prev.country };
                        if (detectedCity) next.city = detectedCity;
                        return next;
                    });
                    const cc = countryCodeFromBigDataCloudReverseClient(data, '');
                    if (detectedCity || cc) {
                        console.log('Location detected (Auto):', detectedCity, cc);
                    }
                } catch (e) {
                    console.warn('Auto-detect location failed:', e?.message || e);
                }
            },
            (err) => {
                console.log('Location detection denied/failed', err);
            },
            GEOLOCATION_OPTIONS
        );
    }, []);

`;

s = s.slice(0, i0) + newBlock + s.slice(i1);
fs.writeFileSync(filePath, s, 'utf8');
console.log('patched', filePath);
