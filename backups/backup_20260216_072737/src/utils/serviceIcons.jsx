import React from 'react';
import {
    FaUtensils, FaCoffee, FaPizzaSlice, FaHamburger, FaIceCream,
    FaWineGlass, FaBeer, FaCocktail, FaGlassWhiskey, FaMugHot,
    FaFish, FaDrumstickBite, FaCarrot, FaCheese, FaBreadSlice,
    FaAppleAlt, FaLemon, FaHotdog, FaCookie, FaCandyCane,
    FaBirthdayCake, FaLeaf, FaPepperHot, FaSeedling, FaEgg,
    FaBlender
} from 'react-icons/fa';
import {
    MdRestaurant, MdLocalBar, MdLocalCafe, MdFastfood,
    MdLocalPizza, MdLunchDining, MdDinnerDining, MdBrunchDining,
    MdBakeryDining, MdIcecream, MdRamenDining, MdSetMeal,
    MdOutlineRamenDining, MdOutlineFastfood
} from 'react-icons/md';

/**
 * Service Icons Library
 * Organized by category for easy selection
 */
export const serviceIcons = {
    // Main Dishes
    mainDishes: [
        { id: 'utensils', icon: FaUtensils, name: 'Dining', color: '#f97316' },
        { id: 'pizza', icon: FaPizzaSlice, name: 'Pizza', color: '#ef4444' },
        { id: 'hamburger', icon: FaHamburger, name: 'Burger', color: '#f59e0b' },
        { id: 'fish', icon: FaFish, name: 'Fish', color: '#06b6d4' },
        { id: 'drumstick', icon: FaDrumstickBite, name: 'Meat', color: '#dc2626' },
        { id: 'hotdog', icon: FaHotdog, name: 'Hot Dog', color: '#ef4444' },
        { id: 'ramen', icon: MdRamenDining, name: 'Ramen', color: '#f59e0b' },
        { id: 'setmeal', icon: MdSetMeal, name: 'Set Meal', color: '#8b5cf6' },
        { id: 'fastfood', icon: MdFastfood, name: 'Fast Food', color: '#ef4444' },
        { id: 'localpizza', icon: MdLocalPizza, name: 'Pizza Slice', color: '#f97316' }
    ],

    // Beverages
    beverages: [
        { id: 'coffee', icon: FaCoffee, name: 'Coffee', color: '#78350f' },
        { id: 'mug', icon: FaMugHot, name: 'Hot Drink', color: '#92400e' },
        { id: 'wine', icon: FaWineGlass, name: 'Wine', color: '#dc2626' },
        { id: 'beer', icon: FaBeer, name: 'Beer', color: '#f59e0b' },
        { id: 'cocktail', icon: FaCocktail, name: 'Cocktail', color: '#ec4899' },
        { id: 'whiskey', icon: FaGlassWhiskey, name: 'Whiskey', color: '#92400e' },
        { id: 'blender', icon: FaBlender, name: 'Smoothie', color: '#10b981' }
    ],

    // Desserts
    desserts: [
        { id: 'icecream', icon: FaIceCream, name: 'Ice Cream', color: '#f472b6' },
        { id: 'cake', icon: FaBirthdayCake, name: 'Cake', color: '#ec4899' },
        { id: 'cookie', icon: FaCookie, name: 'Cookie', color: '#f59e0b' },
        { id: 'candy', icon: FaCandyCane, name: 'Candy', color: '#ef4444' },
        { id: 'mdicecream', icon: MdIcecream, name: 'Ice Cream Cone', color: '#f9a8d4' }
    ],

    // Bakery
    bakery: [
        { id: 'bread', icon: FaBreadSlice, name: 'Bread', color: '#f59e0b' },
        { id: 'bakery', icon: MdBakeryDining, name: 'Bakery', color: '#f97316' },
        { id: 'cheese', icon: FaCheese, name: 'Cheese', color: '#fbbf24' }
    ],

    // Healthy
    healthy: [
        { id: 'carrot', icon: FaCarrot, name: 'Vegetables', color: '#f97316' },
        { id: 'leaf', icon: FaLeaf, name: 'Vegan', color: '#10b981' },
        { id: 'seedling', icon: FaSeedling, name: 'Organic', color: '#22c55e' },
        { id: 'apple', icon: FaAppleAlt, name: 'Apple', color: '#ef4444' },
        { id: 'lemon', icon: FaLemon, name: 'Lemon', color: '#fbbf24' },
        { id: 'egg', icon: FaEgg, name: 'Breakfast', color: '#fbbf24' }
    ],

    // General
    general: [
        { id: 'restaurant', icon: MdRestaurant, name: 'Restaurant', color: '#8b5cf6' },
        { id: 'cafe', icon: MdLocalCafe, name: 'Cafe', color: '#78350f' },
        { id: 'bar', icon: MdLocalBar, name: 'Bar', color: '#dc2626' },
        { id: 'lunch', icon: MdLunchDining, name: 'Lunch', color: '#f59e0b' },
        { id: 'dinner', icon: MdDinnerDining, name: 'Dinner', color: '#8b5cf6' },
        { id: 'brunch', icon: MdBrunchDining, name: 'Brunch', color: '#f97316' },
        { id: 'pepper', icon: FaPepperHot, name: 'Spicy', color: '#dc2626' }
    ]
};

/**
 * Get all icons as a flat array
 */
export const getAllServiceIcons = () => {
    return Object.values(serviceIcons).flat();
};

/**
 * Get icon by ID
 */
export const getServiceIconById = (iconId) => {
    const allIcons = getAllServiceIcons();
    return allIcons.find(icon => icon.id === iconId);
};

/**
 * Get icon component
 */
export const ServiceIcon = ({ iconId, size = 24, color }) => {
    const iconData = getServiceIconById(iconId);
    if (!iconData) return null;

    const IconComponent = iconData.icon;
    return <IconComponent size={size} color={color || iconData.color} />;
};

/**
 * Icon categories for organized display
 */
export const iconCategories = [
    { key: 'mainDishes', label: 'Main Dishes', emoji: '🍽️' },
    { key: 'beverages', label: 'Beverages', emoji: '☕' },
    { key: 'desserts', label: 'Desserts', emoji: '🍰' },
    { key: 'bakery', label: 'Bakery', emoji: '🥐' },
    { key: 'healthy', label: 'Healthy', emoji: '🥗' },
    { key: 'general', label: 'General', emoji: '🍴' }
];
