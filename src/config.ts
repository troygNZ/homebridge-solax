import type { PlatformConfig } from 'homebridge';

export default interface Config extends PlatformConfig {
    address: string;
    latitude?: number;
    longitude?: number;
    exportAlertThresholds?: number[];
}