import React from 'react';
import { PLAN_ENV } from '../constants';
import PlansEnvPage from './PlansEnvPage';

export default function PlansProductionPage() {
    return <PlansEnvPage planEnvironment={PLAN_ENV.PRODUCTION} />;
}
