import { InverterMetrics } from "./inverterMetrics";
import type { Logger } from "homebridge";
import _ from "lodash";
import { ValueStrategy } from "./config";

export default class InverterMetricsHistory {
  private static defaultValue: InverterMetrics = {
    timestamp: new Date(),
    batteryPercentage: 0,
    batteryPowerWatts: 0,
    exportedWatts: 0,
    generationWatts: 0,
    pv1PowerWatts: 0,
    pv2PowerWatts: 0,
  };

  private static readonly joint = ",";

  private readonly inverterStateHistory: Array<InverterMetrics>;
  private computedValues: InverterMetrics;
  private addedRecordCount = 0;

  constructor(
    public readonly log: Logger,
    public readonly valueStrategy: ValueStrategy,
    public readonly movingAverageHistoryLength: number
  ) {
    this.inverterStateHistory = new Array<InverterMetrics>();
    this.computedValues = InverterMetricsHistory.computeValues(this.valueStrategy, this.inverterStateHistory, this.log);
  }

  addReadings(metrics: InverterMetrics): void {
    this.log.debug(`Latest readings added: ${JSON.stringify(metrics, null, "  ")}`);
    this.addedRecordCount++;

    this.inverterStateHistory.push(metrics);
    while (this.inverterStateHistory.length > this.movingAverageHistoryLength) {
      this.inverterStateHistory.shift();
    }

    if (this.addedRecordCount % Math.round(this.movingAverageHistoryLength / 2) === 0) {
      this.log.info(
        `Generation Watts Raw History: [${_.chain(this.inverterStateHistory)
          .map((x) => x.generationWatts)
          .join(InverterMetricsHistory.joint)}]`
      );
      this.log.info(
        `Exported Watts Raw History:   [${_.chain(this.inverterStateHistory)
          .map((x) => x.exportedWatts)
          .join(InverterMetricsHistory.joint)}]`
      );
    }

    this.computedValues = InverterMetricsHistory.computeValues(this.valueStrategy, this.inverterStateHistory, this.log);
  }

  private static computeValues(valueStrategy: ValueStrategy, history: Array<InverterMetrics>, log: Logger): InverterMetrics {
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

  getFilteredValues(): InverterMetrics {
    return this.computedValues;
  }

  getLatestRawValues(): InverterMetrics {
    return _.last(this.inverterStateHistory) ?? InverterMetricsHistory.defaultValue;
  }

  private static computeSimpleMovingAverage(history: Array<InverterMetrics>, log: Logger) {
    if (history.length === 0) {
      return this.defaultValue;
    }
    const results = this.average(history);
    if (results.generationWatts !== 0) {
      log.debug(`Gen Watts Avg      = ${Math.round(results.generationWatts)}`);
    }
    if (results.exportedWatts !== 0) {
      log.debug(`Exported Watts Avg = ${Math.round(results.exportedWatts)}`);
    }
    return results;
  }

  private static computeExponentialMovingAverage(history: Array<InverterMetrics>, log: Logger) {
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
        timestamp: current.timestamp,
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
    if (lastItem.generationWatts !== 0 || smaResult.generationWatts !== 0) {
      log.debug(`Gen Watts EMA      = ${Math.round(lastItem.generationWatts)} (SMA = ${Math.round(smaResult.generationWatts)})`);
    }
    if (lastItem.exportedWatts !== 0 || smaResult.exportedWatts !== 0) {
      log.debug(`Exported Watts EMA = ${Math.round(lastItem.exportedWatts)} (SMA = ${Math.round(smaResult.exportedWatts)})`);
    }
    return lastItem;
  }

  private static sum(metrics: InverterMetrics[]): InverterMetrics {
    return _.reduce<InverterMetrics, InverterMetrics>(
      metrics,
      (a, b) => {
        return {
          timestamp: a.timestamp > b.timestamp ? a.timestamp : b.timestamp,
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

  private static average(metrics: InverterMetrics[]): InverterMetrics {
    const summedResults = this.sum(metrics);
    return {
      timestamp: summedResults.timestamp,
      batteryPercentage: summedResults.batteryPercentage / metrics.length,
      batteryPowerWatts: summedResults.batteryPowerWatts / metrics.length,
      exportedWatts: summedResults.exportedWatts / metrics.length,
      generationWatts: summedResults.generationWatts / metrics.length,
      pv1PowerWatts: summedResults.pv1PowerWatts / metrics.length,
      pv2PowerWatts: summedResults.pv2PowerWatts / metrics.length,
    };
  }
}
