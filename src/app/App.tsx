/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { AppProviders } from "./providers/AppProviders";
import AppLayout from "./components/AppLayout";

export default function App() {
  return (
    <AppProviders>
      <AppLayout />
    </AppProviders>
  );
}
