export interface GoogleBusinessClaimAuthUrlSuccess {
    status: 'ok';
    sessionId: string;
    authUrl: string;
    scope: string;
}

export interface GoogleBusinessManagedLocation {
    name: string;
    title: string;
    storeCode: string | null;
    placeId: string | null;
}

export interface GoogleBusinessVerifyPlaceSuccess {
    status: 'ok';
    managed: boolean;
    placeId: string;
    matchedLocation: GoogleBusinessManagedLocation | null;
    locationCount: number;
}

export interface GoogleBusinessClaimApiError {
    status: 'error';
    code: string;
    message: string;
}

export interface GoogleBusinessClaimRestaurantSuccess {
    status: 'ok';
    uid: string;
    restaurantId: string;
    flow: 'claim';
    verificationMethod: 'google_business_profile';
}
