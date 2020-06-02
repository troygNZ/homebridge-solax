import { InverterLiveMetrics } from "./solaxService";
import type { Logger } from "homebridge";
import _ from "lodash";

export default class InverterStateValuesFilter {
  defaultValue: InverterLiveMetrics = {
    batteryPercentage: 0,
    batteryPowerWatts: 0,
    exportedWatts: 0,
    generationWatts: 0,
    pv1PowerWatts: 0,
    pv2PowerWatts: 0,
  };

  public inverterStateHistory: Array<InverterLiveMetrics>;

  constructor(public readonly log: Logger, public valueStrategy: ValueStrategy) {
    this.inverterStateHistory = new Array<InverterLiveMetrics>();
  }

  addReadings(metrics: InverterLiveMetrics): void {
    this.inverterStateHistory.push(metrics);
    while (this.inverterStateHistory.length > 60) {
      this.inverterStateHistory.shift();
    }
  }

  getValues(): InverterLiveMetrics {
    // TODO - make configurable
    switch (this.valueStrategy) {
      case ValueStrategy.Latest:
        return this.inverterStateHistory.length === 0 ? this.defaultValue : this.inverterStateHistory[this.inverterStateHistory.length];
      case ValueStrategy.Average:
        const len = this.inverterStateHistory.length;
        const lastNSamples = this.inverterStateHistory.slice(Math.max(0, len - 6), len - 1);
        const numSamples = lastNSamples.length;
        _.forEach(lastNSamples, (sample, i) => {
          this.log.debug(`Sample ${i} - ${JSON.stringify(sample)}`);
        });
        if (numSamples === 0) {
          return this.defaultValue;
        }
        return this.average(lastNSamples);
    }
  }

  sum(metrics: InverterLiveMetrics[]): InverterLiveMetrics {
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

  average(metrics: InverterLiveMetrics[]): InverterLiveMetrics {
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

export enum ValueStrategy {
  Latest,
  Average,
  //ExponentialMovingAverage,
}
