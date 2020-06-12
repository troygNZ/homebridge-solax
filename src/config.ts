import type { PlatformConfig } from "homebridge";
import type { Logger } from "homebridge";

export default interface Config {
  address: string;
  movingAverageHistoryLength: number;
  pollingFrequencySeconds: number;
  exportAlertThresholds: number[];
  hasBattery: boolean;
  showStrings: boolean;
  valueStrategy: ValueStrategy;
}

export enum ValueStrategy {
  LatestReading = "Latest Reading",
  SimpleMovingAverage = "Simple Moving Average",
  ExponentialMovingAverage = "Exponential Moving Average",
}

export class ConfigHelper {
  static logDetails(log: Logger, config: Config) {
    log.info(`Solax Host: ${config.address}`);
    log.info(`Polling Freq in Seconds: ${config.pollingFrequencySeconds}`);
    log.info(`Export Alert Thresholds: [${config.exportAlertThresholds.join(",")}]`);
    log.info(`Battery: ${config.hasBattery}`);
    log.info(`Show Strings: ${config.showStrings}`);
    log.info(`Value Strategy: ${config.valueStrategy}`);
    log.info(`Moving Average History Samples Length: ${config.movingAverageHistoryLength}`);
  }
  static applyDefaults(config: PlatformConfig, log: Logger): Config {
    const maybeValueStrategy: ValueStrategy | undefined = (ValueStrategy as any)[config.valueStrategy];
    if (maybeValueStrategy === undefined && config.valueStrategy !== undefined) {
      log.warn(
        `Unknown valueStrategy value of '${config.valueStrategy}'.
         Defaulting to ${ValueStrategy.SimpleMovingAverage} (SimpleMovingAverage)`
      );
    }

    return {
      address: config.address,
      hasBattery: config.hasBattery === undefined ? true : config.hasBattery,
      showStrings: config.showStrings === undefined ? true : config.showStrings,
      movingAverageHistoryLength: config.movingAverageHistoryLength === undefined ? 10 : config.movingAverageHistoryLength,
      pollingFrequencySeconds: config.pollingFrequencySeconds === undefined ? 60 : config.pollingFrequencySeconds,
      exportAlertThresholds: config.exportAlertThresholds === null ? [] : config.exportAlertThresholds,
      valueStrategy: maybeValueStrategy === undefined ? ValueStrategy.SimpleMovingAverage : maybeValueStrategy,
    };
  }
}
