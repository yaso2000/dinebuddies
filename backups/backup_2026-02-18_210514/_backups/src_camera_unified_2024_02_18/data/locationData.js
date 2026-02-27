
export const locationData = {
    // Saudi Arabia
    "SA": {
        name: "Saudi Arabia",
        nameAr: "المملكة العربية السعودية",
        states: {
            "Riyadh Region": ["Riyadh", "Al Kharj", "Diriyah", "Al Majma'ah"],
            "Makkah Region": ["Makkah", "Jeddah", "Taif", "Rabigh"],
            "Eastern Province": ["Dammam", "Khobar", "Jubail", "Dhahran", "Al Ahsa"],
            "Madinah Region": ["Madinah", "Yanbu", "Al Ula"],
            "Asir Region": ["Abha", "Khamis Mushait"],
            "Tabuk Region": ["Tabuk"]
        }
    },
    // United States
    "US": {
        name: "United States",
        nameAr: "الولايات المتحدة",
        states: {
            "New York": ["New York City", "Buffalo", "Rochester"],
            "California": ["Los Angeles", "San Francisco", "San Diego", "San Jose"],
            "Texas": ["Houston", "Austin", "Dallas", "San Antonio"],
            "Florida": ["Miami", "Orlando", "Tampa"],
            "Illinois": ["Chicago"]
        }
    },
    // United Kingdom
    "GB": {
        name: "United Kingdom",
        nameAr: "المملكة المتحدة",
        states: {
            "England": ["London", "Manchester", "Birmingham", "Liverpool"],
            "Scotland": ["Edinburgh", "Glasgow"],
            "Wales": ["Cardiff"],
            "Northern Ireland": ["Belfast"]
        }
    },
    // France
    "FR": {
        name: "France",
        nameAr: "فرنسا",
        states: {
            "Île-de-France": ["Paris", "Versailles"],
            "Provence-Alpes-Côte d'Azur": ["Marseille", "Nice", "Cannes"],
            "Auvergne-Rhône-Alpes": ["Lyon", "Grenoble"]
        }
    },
    // Spain
    "ES": {
        name: "Spain",
        nameAr: "إسبانيا",
        states: {
            "Madrid": ["Madrid"],
            "Catalonia": ["Barcelona", "Girona"],
            "Andalusia": ["Seville", "Málaga"]
        }
    },
    // Australia
    "AU": {
        name: "Australia",
        nameAr: "أستراليا",
        states: {
            "New South Wales": ["Sydney", "Newcastle"],
            "Victoria": ["Melbourne", "Geelong"],
            "Queensland": ["Brisbane", "Gold Coast"],
            "Western Australia": ["Perth"],
            "South Australia": ["Adelaide"]
        }
    },
    // Canada
    "CA": {
        name: "Canada",
        nameAr: "كندا",
        states: {
            "Ontario": ["Toronto", "Ottawa"],
            "Quebec": ["Montreal", "Quebec City"],
            "British Columbia": ["Vancouver", "Victoria"]
        }
    }
};

// Helper to deduce country code from full country name (fallback)
export const getCountryCode = (countryName) => {
    if (!countryName) return 'SA'; // Default
    const lower = countryName.toLowerCase();
    if (lower.includes('saudi') || lower.includes('السعودية')) return 'SA';
    if (lower.includes('united states') || lower.includes('usa') || lower.includes('us')) return 'US';
    if (lower.includes('united kingdom') || lower.includes('uk') || lower.includes('britain')) return 'GB';
    if (lower.includes('france') || lower.includes('فرنسا')) return 'FR';
    if (lower.includes('spain') || lower.includes('إسبانيا')) return 'ES';
    if (lower.includes('australia') || lower.includes('أستراليا')) return 'AU';
    if (lower.includes('canada') || lower.includes('كندا')) return 'CA';
    return 'SA'; // Default fallback
};
