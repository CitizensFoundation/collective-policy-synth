import path from "path";
import express from 'express';
import fs from 'fs';
import { fileURLToPath } from 'url';

import { PolicySynthApiApp } from '@policysynth/api/app.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class EcasYeaServerApi extends PolicySynthApiApp {
  setupStaticPaths() {
    this.app.use(
      express.static(path.join(__dirname, "../dist"))
    );

    this.app.use(
      "/chat*",
      express.static(path.join(__dirname, "../dist"))
    );
  }
}
