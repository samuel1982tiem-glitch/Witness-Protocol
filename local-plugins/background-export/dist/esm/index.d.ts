// Witness Protocol
// Copyright (C) 2026 Samuel Matias Tiem
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program. If not, see <https://www.gnu.org/licenses/>.
//
// SPDX-License-Identifier: GPL-3.0-or-later

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
