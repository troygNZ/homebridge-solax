import { InverterLiveMetrics } from "./solaxService";
import type { Logger } from "homebridge";
import _ from "lodash";
import { ValueStrategy } from "./config";

export default class InverterStateValuesFilter {
  private static readonly historyLength = 60;
  private static readonly simpleMovingAverageLength = 10;

  private static defaultValue: InverterLiveMetrics = {
    batteryPercentage: 0,
    batteryPowerWatts: 0,
    exportedWatts: 0,
    generationWatts: 0,
    pv1PowerWatts: 0,
    pv2PowerWatts: 0,
  };

  private readonly inverterStateHistory: Array<InverterLiveMetrics>;
  private computedValues: InverterLiveMetrics;

  constructor(public readonly log: Logger, public valueStrategy: ValueStrategy) {
    this.inverterStateHistory = new Array<InverterLiveMetrics>();
    this.computedValues = InverterStateValuesFilter.computeValues(this.valueStrategy, this.inverterStateHistory, this.log);
  }

  addReadings(metrics: InverterLiveMetrics): void {
    this.log.debug(`Latest readings added: ${JSON.stringify(metrics, null, "  ")}`);
    this.inverterStateHistory.push(metrics);
    while (this.inverterStateHistory.length > InverterStateValuesFilter.historyLength) {
      this.inverterStateHistory.shift();
    }
    this.computedValues = InverterStateValuesFilter.computeValues(this.valueStrategy, this.inverterStateHistory, this.log);
    this.log.debug(`Calculated values: ${JSON.stringify(this.computedValues, null, "  ")}`);
  }

  private static computeValues(valueStrategy: ValueStrategy, history: Array<InverterLiveMetrics>, log: Logger): InverterLiveMetrics {
    switch (valueStrategy) {
      case ValueStrategy.SimpleMovingAverage:
        return this.computeSimpleMovingAverage(history, log);
      case ValueStrategy.LatestReading:
      default:
        return history.length === 0 ? this.defaultValue : history[history.length - 1];
    }
  }

  getValues(): InverterLiveMetrics {
    return this.computedValues;
  }

  private static computeSimpleMovingAverage(history: Array<InverterLiveMetrics>, log: Logger) {
    const len = history.length;
    const start = Math.max(0, len - this.simpleMovingAverageLength);
    const lastNSamples = history.slice(start, len);

    if (lastNSamples.length === 0) {
      return this.defaultValue;
    }
    const result = this.average(lastNSamples);

    log.debug(`Exported Watts: Avg[${_.map(lastNSamples, (sample) => sample.exportedWatts).join(",")}] = ${result.exportedWatts}`);
    log.debug(`Generation Watts: Avg[${_.map(lastNSamples, (sample) => sample.generationWatts).join(",")}] = ${result.generationWatts}`);
    log.debug(`PV1 Watts: Avg[${_.map(lastNSamples, (sample) => sample.pv1PowerWatts).join(",")}] = ${result.pv1PowerWatts}`);
    log.debug(`PV2 Watts: Avg[${_.map(lastNSamples, (sample) => sample.pv2PowerWatts).join(",")}] = ${result.pv2PowerWatts}`);
    log.debug(`Battery Watts: Avg[${_.map(lastNSamples, (sample) => sample.batteryPowerWatts).join(",")}] = ${result.batteryPowerWatts}`);
    log.debug(
      `Battery Percentage: Avg[${_.map(lastNSamples, (sample) => sample.batteryPercentage).join(",")}] = ${result.batteryPercentage}`
    );

    return result;
  }

  private static sum(metrics: InverterLiveMetrics[]): InverterLiveMetrics {
    return _.reduce<InverterLiveMetrics, InverterLiveMetrics>(
      metrics,
      (a, b) => {
        return {
          batteryPercentage: a.batteryPercentage + b.batteryPercentage,
          batteryPowerWatts: a.batteryPowerWatts + b.batteryPowerWatts,
          exportedWatts: a.exportedWatts + b.exportedWatts,
          generationWatts: a.generationWatts + b.generationWatts,
          pv1PowerWatts: a.pv1PowerWatts + b.pv1PowerWatts,
          pv2PowerWatts: a.pv2PowerWatts + b.pv2PowerWatts,
        };
      },
      this.defaultValue
    );
  }

  private static average(metrics: InverterLiveMetrics[]): InverterLiveMetrics {
    const summedResults = this.sum(metrics);
    return {
      batteryPercentage: summedResults.batteryPercentage / metrics.length,
      batteryPowerWatts: summedResults.batteryPowerWatts / metrics.length,
      exportedWatts: summedResults.exportedWatts / metrics.length,
      generationWatts: summedResults.generationWatts / metrics.length,
      pv1PowerWatts: summedResults.pv1PowerWatts / metrics.length,
      pv2PowerWatts: summedResults.pv2PowerWatts / metrics.length,
    };
  }
}
