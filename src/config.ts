import type { PlatformConfig } from "homebridge";
import type { Logger } from "homebridge";

export default interface Config extends PlatformConfig {
  address: string;
  latitude: number;
  longitude: number;
  exportAlertThresholds: number[];
  hasBattery: boolean;
  showStrings: boolean;
  valueStrategy: ValueStrategy;
}

export enum ValueStrategy {
  LatestReading = "Latest Reading",
  SimpleMovingAverage = "Simple Moving Average",
  //ExponentialMovingAverage,
}

export class ConfigHelper {
  static applyDefaults(config: PlatformConfig, log: Logger): Config {
    const asConfig = config as Config;

    const maybeValueStrategy: ValueStrategy | undefined = (<any>ValueStrategy)[asConfig.valueStrategy];
    if (maybeValueStrategy === undefined) {
      log.warn(
        `Unknown valueStrategy value of '${asConfig.valueStrategy}'. Defaulting to ${ValueStrategy.SimpleMovingAverage} (SimpleMovingAverage)`
      );
    }

    return {
      ...asConfig,
      hasBattery: asConfig.hasBattery === undefined ? true : asConfig.hasBattery,
      showStrings: asConfig.showStrings === undefined ? true : asConfig.showStrings,
      latitude: asConfig.latitude === undefined ? 0 : asConfig.latitude,
      longitude: asConfig.longitude === undefined ? 0 : asConfig.longitude,
      exportAlertThresholds: asConfig.exportAlertThresholds === null ? [] : asConfig.exportAlertThresholds,
      valueStrategy: maybeValueStrategy === undefined ? ValueStrategy.SimpleMovingAverage : maybeValueStrategy,
    };
  }
}
