/**
 * Delivery Platform Registry
 * Logos: SimpleIcons CDN (free, no auth) — https://simpleicons.org
 * For platforms not in SimpleIcons, `logo` is null and `emoji` is used as fallback.
 */

const SI = (slug) => `https://cdn.simpleicons.org/${slug}/FFFFFF`;

export const ALL_PLATFORMS = {
    // ── Global ──────────────────────────────────────────────────────────────
    uberEats: { name: 'Uber Eats', key: 'uberEats', color: '#06C167', gradient: 'linear-gradient(135deg,#06C167,#039855)', logo: SI('ubereats'), emoji: '🟢', placeholder: 'https://www.ubereats.com/store/...' },
    deliveroo: { name: 'Deliveroo', key: 'deliveroo', color: '#00CCBC', gradient: 'linear-gradient(135deg,#00CCBC,#00A396)', logo: SI('deliveroo'), emoji: '🩵', placeholder: 'https://deliveroo.com/menu/...' },
    doorDash: { name: 'DoorDash', key: 'doorDash', color: '#FF3008', gradient: 'linear-gradient(135deg,#FF3008,#CC2606)', logo: SI('doordash'), emoji: '🔴', placeholder: 'https://www.doordash.com/store/...' },

    // ── English – AU/NZ ─────────────────────────────────────────────────────
    // Note: Menulog shut down in AU/NZ in 2024

    // ── English – US ────────────────────────────────────────────────────────
    grubhub: { name: 'Grubhub', key: 'grubhub', color: '#F63440', gradient: 'linear-gradient(135deg,#F63440,#C5101A)', logo: SI('grubhub'), emoji: '🍔', placeholder: 'https://www.grubhub.com/restaurant/...' },
    instacart: { name: 'Instacart', key: 'instacart', color: '#43B02A', gradient: 'linear-gradient(135deg,#43B02A,#2F8218)', logo: SI('instacart'), emoji: '🛒', placeholder: 'https://www.instacart.com/store/...' },

    // ── English – UK/IE ─────────────────────────────────────────────────────
    justEat: { name: 'Just Eat', key: 'justEat', color: '#FF8000', gradient: 'linear-gradient(135deg,#FF8000,#CC6500)', logo: SI('justeat'), emoji: '🟠', placeholder: 'https://www.just-eat.co.uk/restaurants/...' },

    // ── English – CA ────────────────────────────────────────────────────────
    skipthedishes: { name: 'SkipTheDishes', key: 'skipthedishes', color: '#FDB813', gradient: 'linear-gradient(135deg,#FDB813,#CA9200)', logo: null, emoji: '⏭️', placeholder: 'https://www.skipthedishes.com/...' },

    // ── Arabic – Gulf ────────────────────────────────────────────────────────
    hungerStation: { name: 'HungerStation', key: 'hungerStation', color: '#FF5722', gradient: 'linear-gradient(135deg,#FF5722,#D84315)', logo: null, emoji: '🍽️', placeholder: 'https://hungerstation.com/sa-en/...' },
    jahez: { name: 'Jahez', key: 'jahez', color: '#652D90', gradient: 'linear-gradient(135deg,#652D90,#4B1F6A)', logo: null, emoji: '🟣', placeholder: 'https://www.jahez.net/...' },
    talabat: { name: 'Talabat', key: 'talabat', color: '#FF6B00', gradient: 'linear-gradient(135deg,#FF6B00,#CC5500)', logo: null, emoji: '🧡', placeholder: 'https://www.talabat.com/...' },
    careem: { name: 'Careem', key: 'careem', color: '#1DBF73', gradient: 'linear-gradient(135deg,#1DBF73,#14935A)', logo: null, emoji: '🟢', placeholder: 'https://www.careem.com/...' },
    noon: { name: 'Noon Food', key: 'noon', color: '#FEEE00', gradient: 'linear-gradient(135deg,#FEEE00,#DBC800)', logo: null, emoji: '🛍️', placeholder: 'https://food.noon.com/...' },

    // ── Arabic – Levant & North Africa ──────────────────────────────────────
    otlob: { name: 'Otlob', key: 'otlob', color: '#E31E24', gradient: 'linear-gradient(135deg,#E31E24,#B5171C)', logo: null, emoji: '🔴', placeholder: 'https://www.otlob.com/...' },

    // ── Spanish / European ───────────────────────────────────────────────────
    glovo: { name: 'Glovo', key: 'glovo', color: '#FFC244', gradient: 'linear-gradient(135deg,#FFC244,#E8A800)', logo: SI('glovo'), emoji: '🟡', placeholder: 'https://glovoapp.com/...' },
    rappi: { name: 'Rappi', key: 'rappi', color: '#FF441F', gradient: 'linear-gradient(135deg,#FF441F,#CC3015)', logo: SI('rappi'), emoji: '🔴', placeholder: 'https://www.rappi.com/...' },
    pedidosYa: { name: 'PedidosYa', key: 'pedidosYa', color: '#FA1C28', gradient: 'linear-gradient(135deg,#FA1C28,#C5101A)', logo: null, emoji: '🛵', placeholder: 'https://www.pedidosya.com/...' },

    // ── German / European ────────────────────────────────────────────────────
    lieferando: { name: 'Lieferando', key: 'lieferando', color: '#FF8000', gradient: 'linear-gradient(135deg,#FF8000,#CC6500)', logo: null, emoji: '🟠', placeholder: 'https://www.lieferando.de/...' },
    wolt: { name: 'Wolt', key: 'wolt', color: '#009DE0', gradient: 'linear-gradient(135deg,#009DE0,#006DAA)', logo: SI('wolt'), emoji: '🔵', placeholder: 'https://wolt.com/...' },
};

export const PLATFORMS_BY_COUNTRY = {
    // 🇦🇺 English – Oceania (Menulog shut down 2024)
    AU: ['uberEats', 'doorDash', 'deliveroo'],
    NZ: ['uberEats', 'doorDash', 'deliveroo'],

    // 🇺🇸 English – North America
    US: ['uberEats', 'doorDash', 'grubhub', 'instacart'],
    CA: ['uberEats', 'doorDash', 'skipthedishes'],

    // 🇬🇧 English – UK & Ireland
    GB: ['uberEats', 'deliveroo', 'justEat'],
    IE: ['uberEats', 'deliveroo', 'justEat'],

    // 🌍 Arabic – Gulf
    SA: ['uberEats', 'hungerStation', 'jahez', 'talabat', 'careem'],
    AE: ['uberEats', 'talabat', 'careem', 'noon', 'deliveroo'],
    KW: ['uberEats', 'talabat', 'careem', 'deliveroo'],
    QA: ['uberEats', 'talabat', 'careem', 'deliveroo'],
    BH: ['uberEats', 'talabat', 'careem'],
    OM: ['uberEats', 'talabat', 'careem'],

    // 🌍 Arabic – Levant & North Africa
    EG: ['uberEats', 'otlob', 'talabat', 'careem'],
    JO: ['uberEats', 'talabat', 'careem'],
    LB: ['uberEats', 'talabat', 'careem'],
    MA: ['uberEats', 'glovo', 'careem'],
    TN: ['uberEats', 'glovo'],
    DZ: ['uberEats', 'glovo'],

    // 🇫🇷 French – France & Francophone Europe
    FR: ['uberEats', 'deliveroo', 'justEat'],
    BE: ['uberEats', 'deliveroo', 'justEat'],
    CH: ['uberEats', 'deliveroo', 'wolt'],

    // 🇪🇸 Spanish – Spain
    ES: ['uberEats', 'glovo', 'justEat'],

    // 🇲🇽 Spanish – Latin America
    MX: ['uberEats', 'rappi', 'doorDash'],
    CO: ['uberEats', 'rappi', 'pedidosYa'],
    AR: ['uberEats', 'rappi', 'pedidosYa'],
    CL: ['uberEats', 'rappi', 'pedidosYa'],
    BR: ['uberEats', 'rappi'],
    PE: ['uberEats', 'rappi', 'pedidosYa'],

    // 🇩🇪 German – DACH
    DE: ['uberEats', 'lieferando', 'wolt'],
    AT: ['uberEats', 'lieferando', 'wolt'],
};

/**
 * Get the list of platforms for a given ISO country code.
 * Falls back to a sensible global default.
 */
export function getPlatformsForCountry(countryCode = '') {
    const keys = PLATFORMS_BY_COUNTRY[countryCode.toUpperCase()] || ['uberEats', 'doorDash', 'deliveroo'];
    const seen = new Set();
    return keys
        .map(k => ALL_PLATFORMS[k])
        .filter(p => p && !seen.has(p.key) && seen.add(p.key));
}
