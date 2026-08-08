import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.join(__dirname, '..', 'src', 'components', 'CreateBusinessAccount.jsx');

let s = fs.readFileSync(filePath, 'utf8');
const markerStart = "    // Get user's location and detect city/country automatically";
const markerEnd = '    const handleChange';

const i0 = s.indexOf(markerStart);
const i1 = s.indexOf(markerEnd);
if (i0 === -1 || i1 === -1) {
    console.error('markers not found', { i0, i1 });
    process.exit(1);
}

const newBlock = `    // Get user's location and detect city/country automatically
    useEffect(() => {
        if (!navigator.geolocation) return;
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;

                setFormData((prev) => ({
                    ...prev,
                    userLat: lat,
                    userLng: lng,
                }));

                try {
                    const response = await fetch(
                        \`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=\${lat}&longitude=\${lng}&localityLanguage=en\`
                    );

                    if (!response.ok) throw new Error('Geocoding failed');

                    const data = await response.json();
                    if (!data) return;

                    const city = cityFromBigDataCloudReverseClient(data);
                    const country = String(data.countryName || '').trim() || 'Australia';
                    const countryCode = countryCodeFromBigDataCloudReverseClient(data, 'AU');

                    console.log('Detected location (Auto):', { city, country, countryCode });

                    setFormData((prev) => ({
                        ...prev,
                        countryCode: countryCode || prev.countryCode,
                        country,
                        ...(city ? { city } : {}),
                    }));
                } catch (error) {
                    console.error('Reverse geocoding failed:', error);
                }
            },
            (error) => console.log('Location access denied:', error),
            GEOLOCATION_OPTIONS
        );
    }, []);

`;

s = s.slice(0, i0) + newBlock + s.slice(i1);
fs.writeFileSync(filePath, s, 'utf8');
console.log('patched CreateBusinessAccount.jsx');
