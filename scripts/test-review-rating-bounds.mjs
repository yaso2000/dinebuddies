/**
 * Regression: unbounded review.rating must not poison averages / rankings.
 * - Unit-tests functions/reviewRatingAggregate.js
 * - Static-checks firestore.rules + CF wiring
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const {
    normalizeStarRating,
    aggregateReviewRatings,
} = require(join(root, 'functions/reviewRatingAggregate.js'));

function assert(cond, msg) {
    if (!cond) {
        console.error('FAIL:', msg);
        process.exit(1);
    }
}

// normalizeStarRating
assert(normalizeStarRating(1) === 1, '1 is valid');
assert(normalizeStarRating(5) === 5, '5 is valid');
assert(normalizeStarRating(3.5) === 3.5, 'mid-range float is valid');
assert(normalizeStarRating(0) === null, '0 is invalid');
assert(normalizeStarRating(999999) === null, 'huge rating is invalid');
assert(normalizeStarRating(-2) === null, 'negative is invalid');
assert(normalizeStarRating('nope') === null, 'non-numeric is invalid');
assert(normalizeStarRating(null) === null, 'null is invalid');

// aggregateReviewRatings: forgery must not affect average
const forged = aggregateReviewRatings([
    { id: 'a', rating: 5 },
    { id: 'b', rating: 999999 },
    { id: 'c', rating: 4 },
    { id: 'a', rating: 5 }, // duplicate id ignored
]);
assert(forged.reviewCount === 2, `expected 2 valid reviews, got ${forged.reviewCount}`);
assert(forged.averageRating === 4.5, `expected avg 4.5, got ${forged.averageRating}`);

const empty = aggregateReviewRatings([{ id: 'x', rating: 1e15 }]);
assert(empty.reviewCount === 0 && empty.averageRating === 0, 'only-forged set must average 0');

// Rules must enforce [1, 5] on create/update
const rules = readFileSync(join(root, 'firestore.rules'), 'utf8');
const reviewsBlock = rules.slice(
    rules.indexOf('match /reviews/{reviewId}'),
    rules.indexOf('match /reports/{reportId}')
);
assert(reviewsBlock.includes('request.resource.data.rating >= 1'), 'rules must require rating >= 1');
assert(reviewsBlock.includes('request.resource.data.rating <= 5'), 'rules must require rating <= 5');
assert(reviewsBlock.includes('rating is number'), 'rules must require rating is number');
assert(
    reviewsBlock.includes('allow update:') && reviewsBlock.includes('rating <= 5'),
    'update path must also bound rating'
);

// CF trigger must use the bounded aggregator
const indexJs = readFileSync(join(root, 'functions/index.js'), 'utf8');
assert(
    indexJs.includes("require('./reviewRatingAggregate')") ||
        indexJs.includes('require("./reviewRatingAggregate")'),
    'functions/index.js must import reviewRatingAggregate'
);
assert(
    indexJs.includes('aggregateReviewRatings'),
    'updateBusinessRatingOnReview must call aggregateReviewRatings'
);
assert(
    !indexJs.includes('total += doc.data().rating || 0'),
    'raw unbounded rating sum must be removed from CF aggregator'
);

// Client ranking loader must also ignore out-of-range ratings
const rankingLoader = readFileSync(join(root, 'src/services/rankingDataLoader.js'), 'utf8');
assert(
    rankingLoader.includes('n >= 1 && n <= 5'),
    'rankingDataLoader must filter ratings to [1, 5]'
);

console.log('test-review-rating-bounds: all assertions passed');
