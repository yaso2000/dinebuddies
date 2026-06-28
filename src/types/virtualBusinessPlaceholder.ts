export type VirtualBusinessStatus = 'ai-generated';

export type BusinessCreatedBy = 'admin' | 'user';

export interface RestaurantCoordinates {
    lat: number | null;
    lng: number | null;
}

export interface RestaurantOwnershipFields {
    createdBy: BusinessCreatedBy;
    isClaimed: boolean;
    claimed: boolean;
    isVirtual: boolean;
    ownerId: string;
}

/** Normalized Google Places fields persisted on restaurants/{id}. */
export interface RestaurantGoogleFields {
    name: string;
    phone: string;
    website: string;
    address: string;
    coordinates: RestaurantCoordinates;
    openingHours: unknown;
    categories: string[];
}

export interface VirtualBusinessPlaceholder extends RestaurantOwnershipFields, RestaurantGoogleFields {
    googlePlaceId: string;
    /** Converted BusinessHours shape (businessInfo.hours). */
    hours?: Record<string, unknown> | null;
    coverImage: string | null;
    coverImageFromFirebase?: boolean;
    coverImageStoragePath?: string | null;
    googlePhotoReference?: string | null;
    status: VirtualBusinessStatus;
    collection?: 'restaurants';
}

/** Result of fetchGooglePlaceMinimal — maps Google API names to Firestore schema. */
export interface GooglePlacesMinimalDetails extends RestaurantGoogleFields {
    googlePlaceId: string;
    city: string;
    country: string;
    hours: Record<string, unknown> | null;
    openNow: boolean | null;
    businessType: string;
    googlePhotoReference: string | null;
    coverImageUrl: string;
    coverImageStoragePath: string | null;
    coverImageFromFirebase: boolean;
    photoError?: { code: string; message: string } | null;
}

/** Phase 1 preview payload — Google fields without Storage/Firestore side effects. */
export interface GooglePlacesPreviewPayload extends GooglePlacesMinimalDetails {
    /** Not included in JSON preview object — sent as top-level previewCoverImage. */
    previewCoverImage?: string | null;
}

export interface BusinessImportDuplicateMatch {
    docId: string;
    name: string;
    matchReason: 'phone' | 'coordinates' | 'address';
    googlePlaceId?: string | null;
}

export interface ImportFromGooglePreviewSuccess {
    status: 'ok';
    action: 'preview';
    placeId: string;
    preview: GooglePlacesPreviewPayload;
    /** data:image/jpeg;base64,... for instant admin dashboard preview */
    previewCoverImage: string | null;
    alreadyExisted?: boolean;
    docId?: string;
    photoWarning?: { code: string; message: string };
    duplicateMatches?: BusinessImportDuplicateMatch[];
    duplicateMergeTarget?: string;
    duplicateMergeReason?: BusinessImportDuplicateMatch['matchReason'];
}

export interface ImportFromGooglePublishSuccess {
    status: 'ok';
    action: 'publish';
    docId: string;
    placeholder: VirtualBusinessPlaceholder;
    collection?: 'restaurants';
    alreadyExisted?: boolean;
    refreshed?: boolean;
    mergedFromDuplicate?: boolean;
    duplicateMergeReason?: BusinessImportDuplicateMatch['matchReason'];
    duplicateMatches?: BusinessImportDuplicateMatch[];
    directorySynced?: boolean;
    photoWarning?: { code: string; message: string };
}

/** @deprecated Use ImportFromGooglePublishSuccess */
export type ImportFromGoogleApiSuccess = ImportFromGooglePublishSuccess;

export interface ImportFromGoogleApiError {
    status: 'error';
    code: string;
    message: string;
}

export interface ClaimRestaurantApiSuccess {
    status: 'ok';
    uid: string;
    restaurantId: string;
    flow: 'claim';
}

export interface ClaimRestaurantApiError {
    status: 'error';
    code: string;
    message: string;
}
