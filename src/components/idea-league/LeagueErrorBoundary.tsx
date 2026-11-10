"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  fallback: (retry: () => void, message: string) => ReactNode;
};

type State = { error: Error | null };

export class LeagueErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[IdeaLeague]", error, info.componentStack);
  }

  retry = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      return this.props.fallback(this.retry, this.state.error.message || "render failed");
    }
    return this.props.children;
  }
}
