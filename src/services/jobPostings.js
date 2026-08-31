import { getFunctions, httpsCallable } from 'firebase/functions';
import app from '../firebase/config';

/**
 * Thin callable wrappers for the business job postings + applications backend
 * (functions/jobPostings.js). All writes are server-mediated.
 */
const fns = () => getFunctions(app, 'us-central1');

export function createJobPosting(payload) {
    return httpsCallable(fns(), 'createJobPosting')(payload).then((r) => r.data);
}

export function updateJobPosting(payload) {
    return httpsCallable(fns(), 'updateJobPosting')(payload).then((r) => r.data);
}

export function deleteJobPosting(jobId) {
    return httpsCallable(fns(), 'deleteJobPosting')({ jobId }).then((r) => r.data);
}

export function submitJobApplication(payload) {
    return httpsCallable(fns(), 'submitJobApplication')(payload).then((r) => r.data);
}

export function setJobApplicationStatus(applicationId, status) {
    return httpsCallable(fns(), 'setJobApplicationStatus')({ applicationId, status }).then((r) => r.data);
}

/** Canonical job-type keys — used for the editor selector + label translation. */
export const JOB_TYPES = ['full_time', 'part_time', 'temporary', 'internship', 'seasonal', 'contract'];
