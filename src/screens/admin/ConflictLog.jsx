import React from 'react';
import ConflictLogPanel from '../../components/ConflictLogPanel';
import { useMockApp } from '../../lib/mock-state';

export default function ConflictLog() {
  const { results } = useMockApp();
  return <ConflictLogPanel results={results} />;
}
