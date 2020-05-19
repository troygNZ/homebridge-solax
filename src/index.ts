import type { API } from 'homebridge';

import { PLATFORM_NAME } from './settings';
import { SolaxPlatform } from './solaxPlatform'; 

/**
 * This method registers the platform with Homebridge
 */
export = (api: API) => {
  api.registerPlatform(PLATFORM_NAME, SolaxPlatform);
}
