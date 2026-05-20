import {
    FaBeer,
    FaCoffee,
    FaFilm,
    FaFutbol,
    FaMicrophone,
    FaMusic,
    FaUtensils,
} from 'react-icons/fa';
import { PUBLIC_VENUE_TYPES } from '../utils/publicInvitationVibes';

const VENUE_ICON_BY_TYPE = {
    Restaurant: FaUtensils,
    Cafe: FaCoffee,
    Bar: FaBeer,
    'Night Club': FaMusic,
    Cinema: FaFilm,
    Concert: FaMicrophone,
    'Sports Match': FaFutbol,
};

/** Venue categories for public invitation create (type + monochrome icon). */
export const PUBLIC_VENUE_CATEGORIES = PUBLIC_VENUE_TYPES.map((type) => ({
    type,
    Icon: VENUE_ICON_BY_TYPE[type] || FaUtensils,
}));
