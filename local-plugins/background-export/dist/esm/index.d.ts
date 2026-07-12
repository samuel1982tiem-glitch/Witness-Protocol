export interface BackgroundExportPlugin {
  /**
   * Starts the foreground service and shows an initial (typically
   * indeterminate) progress notification. Call this once at the start
   * of a long export.
   */
  start(options: { title: string; text: string; indeterminate?: boolean }): Promise<{ started: boolean }>;

  /**
   * Updates the existing notification's text/progress. Safe to call
   * frequently -- Android coalesces rapid notification updates.
   */
  update(options: {
    title: string;
    text: string;
    progress?: number;
    max?: number;
    indeterminate?: boolean;
  }): Promise<void>;

  /**
   * Stops the foreground service and removes the notification. Call
   * this once the export finishes (success or failure) -- always in a
   * `finally` block so it can't be left running.
   */
  stop(): Promise<void>;
}

export declare const BackgroundExport: BackgroundExportPlugin;
