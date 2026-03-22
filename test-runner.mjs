import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

// Simple alias resolver for tests
register('./test-loader.mjs', pathToFileURL('./'));
