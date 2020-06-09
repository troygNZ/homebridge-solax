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
  }

  private static computeValues(valueStrategy: ValueStrategy, history: Array<InverterLiveMetrics>, log: Logger): InverterLiveMetrics {
    switch (valueStrategy) {
      case ValueStrategy.ExponentialMovingAverage:
        return this.computeExponentialMovingAverage(history, log);
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
    debug: boolean,
    label: string,
    mapper: (record: InverterLiveMetrics) => number,
    history: Array<InverterLiveMetrics>,
    result: number
  ) {
    if (
      // If we have a non 0 result, or any of the history for this metric is non-zero
      result !== 0 ||
      _.chain(history)
        .map(mapper)
        .some((x) => x !== 0)
        .value()
    ) {
      let logStringFn: () => string;
      if (history.length <= 10) {
        logStringFn = () => `${label}: [${_.chain(history).map(mapper).join(this.joint)}] = ${Math.round(result)}`;
      } else {
        logStringFn = () =>
          `${label}: [${_.chain(history).map(mapper).take(4).join(this.joint)} ... ${_.chain(history)
            .map(mapper)
            .takeRight(4)
            .join(",")}}] = ${Math.round(result)}`;
      }
      if (debug) {
        log.debug(logStringFn());
      } else {
        log.info(logStringFn());
      }
    }
  }

  private static computeSimpleMovingAverage(history: Array<InverterLiveMetrics>, log: Logger) {
    if (history.length === 0) {
      return this.defaultValue;
    }
    const results = this.average(history);
    this.logAverageDetails(log, false, "Exported Watts", (sample) => sample.exportedWatts, history, results.exportedWatts);
    this.logAverageDetails(log, false, "Gen Watts", (sample) => sample.generationWatts, history, results.generationWatts);

    return results;
  }

  private static computeExponentialMovingAverage(history: Array<InverterLiveMetrics>, log: Logger) {
    if (history.length === 0) {
      return this.defaultValue;
    }
    const k = 2 / (history.length + 1);
    // first item is just the same as the first item in the input
    const results = [history[0]];
    // for the rest of the items, they are computed with the previous one
    for (let i = 1; i < history.length; i++) {
      const current = history[i];
      results.push({
        generationWatts: current.generationWatts * k + results[i - 1].generationWatts * (1 - k),
        exportedWatts: current.exportedWatts * k + results[i - 1].exportedWatts * (1 - k),
        batteryPercentage: current.batteryPercentage * k + results[i - 1].batteryPercentage * (1 - k),
        batteryPowerWatts: current.batteryPowerWatts * k + results[i - 1].batteryPowerWatts * (1 - k),
        pv1PowerWatts: current.pv1PowerWatts * k + results[i - 1].pv1PowerWatts * (1 - k),
        pv2PowerWatts: current.pv2PowerWatts * k + results[i - 1].pv2PowerWatts * (1 - k),
      });
    }

    const lastItem = results[results.length - 1];
    const smaResult = this.average(history);
    this.logAverageDetails(log, true, "Exported Watts Input", (sample) => sample.exportedWatts, history, smaResult.exportedWatts);
    this.logAverageDetails(log, true, "Gen Watts Input", (sample) => sample.generationWatts, history, smaResult.generationWatts);
    this.logAverageDetails(log, false, "Exported Watts EMA", (sample) => sample.exportedWatts, history, lastItem.exportedWatts);
    this.logAverageDetails(log, false, "Gen Watts EMA", (sample) => sample.generationWatts, history, lastItem.generationWatts);

    return lastItem;
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
