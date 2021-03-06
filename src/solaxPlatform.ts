import { APIEvent } from "homebridge";
import type { API, StaticPlatformPlugin, Logger, AccessoryPlugin, PlatformConfig } from "homebridge";
import util from "util";
import { getValuesAsync } from "./solaxService";
import Config, { ConfigHelper } from "./config";
import WattsReadingAccessory from "./wattsReadingAccessory";
import PowerThresholdMotionSensor from "./powerThresholdMotionSensor";
import SolarBattery from "./solarBattery";
import { EventEmitter } from "events";
import InverterMetricsHistory from "./inverterMetricsHistory";
import _ from "lodash";

export class InverterStateEmitter extends EventEmitter {}

export class SolaxPlatform implements StaticPlatformPlugin {
  public readonly inverterStateEmitter = new InverterStateEmitter();
  public readonly config: Config;
  public readonly history: InverterMetricsHistory;

  constructor(public readonly log: Logger, config: PlatformConfig, public readonly api: API) {
    this.inverterStateEmitter.setMaxListeners(15);
    this.log.debug(`Config: \n${JSON.stringify(config, null, "  ")}`);
    this.config = ConfigHelper.applyDefaults(config, this.log);
    ConfigHelper.logDetails(this.log, this.config);

    this.history = new InverterMetricsHistory(this.log, this.config.valueStrategy, this.config.movingAverageHistoryLength);
    this.log.debug("Finished initializing platform:", config.name);

    this.api.on(APIEvent.DID_FINISH_LAUNCHING, () => {
      log.debug("Executed didFinishLaunching callback");
      this.sleep(5000).then(async () => await this.getLatestReadingsPeriodically());
      setInterval(() => this.checkForStalledTimeout(), this.config.pollingFrequencySeconds * 1000 * 2);
    });
  }

  sleep = util.promisify(setTimeout);

  private async checkForStalledTimeout() {
    const latestRaw = this.history.getLatestRawValues();
    const now = new Date();
    const diffSeconds = (now.getTime() - latestRaw.timestamp.getTime()) / 1000;
    if (this.config.pollingFrequencySeconds * 4 < diffSeconds) {
      this.log.warn(
        `Detected data hasn't been updated for ${diffSeconds} seconds.
Where the polling frequency is ${this.config.pollingFrequencySeconds} seconds. Kicking it in the guts!`
      );
      await this.getLatestReadingsPeriodically();
    }
  }

  private async getLatestReadingsPeriodically() {
    try {
      const inverterState = await getValuesAsync(this.log, this.config);
      this.history.addReadings(inverterState);
      this.inverterStateEmitter.emit("event");
    } catch (error) {
      this.log.error(`Failed to read from Solax. Error: ${error}`);
    } finally {
      this.log.debug(`Delaying for ${this.config.pollingFrequencySeconds} seconds.`);
      this.sleep(this.config.pollingFrequencySeconds * 1000).then(async () => await this.getLatestReadingsPeriodically());
    }
  }

  /*
   * This method is called to retrieve all accessories exposed by the platform.
   * The Platform can delay the response my invoking the callback at a later time,
   * it will delay the bridge startup though, so keep it to a minimum.
   * The set of exposed accessories CANNOT change over the lifetime of the plugin!
   */
  accessories(callback: (foundAccessories: AccessoryPlugin[]) => void): void {
    const accessories: AccessoryPlugin[] = [
      new WattsReadingAccessory(this.api.hap, this.log, "Exported Watts", this.inverterStateEmitter, () => {
        const result = this.history.getFilteredValues().exportedWatts;
        return result >= 0 ? result : 0;
      }),

      new WattsReadingAccessory(this.api.hap, this.log, "Imported Watts", this.inverterStateEmitter, () => {
        const result = this.history.getFilteredValues().exportedWatts;
        return result < 0 ? Math.abs(result) : 0;
      }),

      new WattsReadingAccessory(this.api.hap, this.log, "Power Gen Watts", this.inverterStateEmitter, () => {
        return this.history.getFilteredValues().generationWatts;
      }),
    ];

    const rawAccessories: AccessoryPlugin[] = this.config.exposeRawMetrics
      ? [
          new WattsReadingAccessory(this.api.hap, this.log, "Exported Watts Raw", this.inverterStateEmitter, () => {
            const result = this.history.getLatestRawValues().exportedWatts;
            return result >= 0 ? result : 0;
          }),
          new WattsReadingAccessory(this.api.hap, this.log, "Imported Watts Raw", this.inverterStateEmitter, () => {
            const result = this.history.getLatestRawValues().exportedWatts;
            return result < 0 ? Math.abs(result) : 0;
          }),
          new WattsReadingAccessory(this.api.hap, this.log, "Power Gen Watts Raw", this.inverterStateEmitter, () => {
            return this.history.getLatestRawValues().generationWatts;
          }),
        ]
      : [];

    let battery: SolarBattery | null = null;
    if (this.config.hasBattery) {
      const getDetails = () => {
        const result = this.history.getFilteredValues();
        return {
          batteryPercentage: result.batteryPercentage,
          batteryWatts: result.batteryPowerWatts,
        };
      };
      battery = new SolarBattery(this.api.hap, this.log, "Solar Battery", this.inverterStateEmitter, getDetails);
    }

    const inverterStrings = this.config.showStrings
      ? [
          new WattsReadingAccessory(this.api.hap, this.log, "PV1 Watts", this.inverterStateEmitter, () => {
            return this.history.getFilteredValues().pv1PowerWatts;
          }),

          new WattsReadingAccessory(this.api.hap, this.log, "PV2 Watts", this.inverterStateEmitter, () => {
            return this.history.getFilteredValues().pv2PowerWatts;
          }),
        ]
      : [];

    const exportAlarms = _.map(this.config.exportAlertThresholds, (threshold) => {
      let name: string;
      let evalutation: () => boolean;

      if (threshold < 0) {
        name = `${Math.abs(threshold)} watts imported`;
        evalutation = () => this.history.getFilteredValues().exportedWatts <= threshold;
      } else {
        name = `${threshold} watts exported`;
        evalutation = () => this.history.getFilteredValues().exportedWatts >= threshold;
      }

      return new PowerThresholdMotionSensor(this.api.hap, this.log, name, this.inverterStateEmitter, evalutation);
    });

    return callback(
      accessories
        .concat(exportAlarms)
        .concat(battery === null ? [] : battery)
        .concat(inverterStrings)
        .concat(rawAccessories)
    );
  }
}
