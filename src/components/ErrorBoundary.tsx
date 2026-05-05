import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  errorStr: string;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    errorStr: ""
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorStr: error.toString() };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
          return this.props.fallback;
      }
      return (
        <div className="p-4 bg-red-900/50 text-red-200 border border-red-500 rounded-md whitespace-pre-wrap font-mono text-xs overflow-auto w-full h-full relative z-[100]">
          <h2>Something went wrong in the component tree.</h2>
          <p>{this.state.errorStr}</p>
        </div>
      );
    }

    return this.props.children;
  }
}
