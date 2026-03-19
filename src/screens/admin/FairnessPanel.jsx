import React from 'react';
import FairnessDashboard from '../../components/FairnessDashboard';
import { useMockApp } from '../../lib/mock-state';

export default function FairnessPanel() {
  const { results, queue } = useMockApp();
  return <FairnessDashboard results={results} initialQueue={queue} />;
}
