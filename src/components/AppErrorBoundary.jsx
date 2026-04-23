import React from 'react';
import { CONCEPT_THEME } from '../lib/theme';

export default class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('App render error:', error, info);
  }

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    return (
      <div
        className="flex min-h-screen items-center justify-center px-4 concept-font-body"
        style={{ background: CONCEPT_THEME.cream }}
      >
        <div
          className="w-full max-w-xl rounded-3xl border bg-white px-6 py-8 shadow-sm"
          style={{ borderColor: CONCEPT_THEME.borderLight }}
        >
          <div className="text-xs font-bold uppercase tracking-[0.2em]" style={{ color: CONCEPT_THEME.error }}>
            Runtime Error
          </div>
          <h1 className="concept-font-display mt-3 text-2xl font-bold" style={{ color: CONCEPT_THEME.navy }}>
            The app hit a render failure.
          </h1>
          <p className="mt-3 text-sm leading-6" style={{ color: CONCEPT_THEME.muted }}>
            Open the browser console and copy the error message. This screen replaces the previous blank white page.
          </p>
          <pre
            className="mt-5 overflow-x-auto rounded-2xl px-4 py-3 text-xs"
            style={{ background: CONCEPT_THEME.sand, color: CONCEPT_THEME.text }}
          >
            {String(this.state.error?.stack || this.state.error?.message || this.state.error)}
          </pre>
        </div>
      </div>
    );
  }
}
