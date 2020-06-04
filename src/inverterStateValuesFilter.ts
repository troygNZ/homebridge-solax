import { InverterLiveMetrics } from "./solaxService";
import type { Logger } from "homebridge";
import _ from "lodash";
import { ValueStrategy } from "./config";

export default class InverterStateValuesFilter {
  private static defaultValue: InverterLiveMetrics = {
    batteryPercentage: 0,
    batteryPowerWatts: 0,
    exportedWatts: 0,
    generationWatts: 0,
    pv1PowerWatts: 0,
    pv2PowerWatts: 0,
  };
  private static readonly joint = ",";

  private readonly inverterStateHistory: Array<InverterLiveMetrics>;
  private computedValues: InverterLiveMetrics;

  constructor(
    public readonly log: Logger,
    public readonly valueStrategy: ValueStrategy,
    public readonly movingAverageHistoryLength: number
  ) {
    this.inverterStateHistory = new Array<InverterLiveMetrics>();
    this.computedValues = InverterStateValuesFilter.computeValues(this.valueStrategy, this.inverterStateHistory, this.log);
  }

  addReadings(metrics: InverterLiveMetrics): void {
    this.log.debug(`Latest readings added: ${JSON.stringify(metrics, null, "  ")}`);
    this.inverterStateHistory.push(metrics);
    while (this.inverterStateHistory.length > this.movingAverageHistoryLength) {
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

  private static logAverageDetails(
    log: Logger,
    label: string,
    mapper: (record: InverterLiveMetrics) => number,
    history: Array<InverterLiveMetrics>,
    result: number
  ) {
    if (
      result !== 0 ||
      _.chain(history)
        .map(mapper)
        .some((x) => x !== 0)
        .value()
    ) {
      if (history.length === 1) {
        log.info(`${label}: Avg[${_.chain(history).map(mapper).first()}] = ${result}`);
      } else if (history.length === 2) {
        log.info(`${label}: Avg[${_.chain(history).map(mapper).first()},${_.chain(history).map(mapper).last()}] = ${result}`);
      } else {
        log.info(`${label}: Avg[${_.chain(history).map(mapper).first()} ... ${_.chain(history).map(mapper).last()}] = ${result}`);
        log.debug(`${label}: Avg[${_.map(history, mapper).join(this.joint)}] = ${result}`);
      }
    }
  }

  private static computeSimpleMovingAverage(history: Array<InverterLiveMetrics>, log: Logger) {
    if (history.length === 0) {
      return this.defaultValue;
    }
    const results = this.average(history);
    this.logAverageDetails(log, "Exported Watts", (sample) => sample.exportedWatts, history, results.exportedWatts);
    this.logAverageDetails(log, "Gen Watts", (sample) => sample.generationWatts, history, results.generationWatts);
    this.logAverageDetails(log, "PV1 Watts", (sample) => sample.pv1PowerWatts, history, results.pv1PowerWatts);
    this.logAverageDetails(log, "PV2 Watts", (sample) => sample.pv2PowerWatts, history, results.pv2PowerWatts);
    this.logAverageDetails(log, "Batt Watts", (sample) => sample.batteryPowerWatts, history, results.batteryPowerWatts);
    this.logAverageDetails(log, "Batt %", (sample) => sample.batteryPercentage, history, results.batteryPercentage);
    return results;
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
