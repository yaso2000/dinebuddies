export type BusinessCoverImageErrorCode =
    | 'invalid_place_id'
    | 'method_not_allowed'
    | 'cover_not_found'
    | 'cover_empty';

export interface BusinessCoverImageErrorResponse {
    error: BusinessCoverImageErrorCode;
}
