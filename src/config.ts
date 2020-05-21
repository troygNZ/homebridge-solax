import type { PlatformConfig } from 'homebridge';

export interface Config extends PlatformConfig {
    address: string;
    latitude?: number;
    longitude?: number;
}