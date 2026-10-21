import {chrome} from 'jest-chrome';
import {vi} from 'vitest';

/* eslint-disable unicorn/no-global-object-property-assignment -- Test setup */

// For `jest-chrome` https://github.com/vitest-dev/vitest/issues/2667
globalThis.jest = vi;

globalThis.chrome = chrome;
/* eslint-enable unicorn/no-global-object-property-assignment */
