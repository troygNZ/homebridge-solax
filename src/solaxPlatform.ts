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

    this.log.info(`Solax Host: ${this.config.address}`);
    this.log.info(`Polling Freq in Seconds: ${this.config.pollingFrequencySeconds}`);
    this.log.info(`Export Alert Thresholds: [${this.config.exportAlertThresholds.join(",")}]`);
    this.log.info(`Battery: ${this.config.hasBattery}`);
    this.log.info(`Show Strings: ${this.config.showStrings}`);
    this.log.info(`Value Strategy: ${this.config.valueStrategy}`);
    this.log.info(`Moving Average History Samples Length: ${this.config.movingAverageHistoryLength}`);

    this.history = new InverterMetricsHistory(this.log, this.config.valueStrategy, this.config.movingAverageHistoryLength);

    this.log.debug("Finished initializing platform:", config.name);

    this.api.on(APIEvent.DID_FINISH_LAUNCHING, () => {
      log.debug("Executed didFinishLaunching callback");
      this.sleep(5000).then(async () => await this.getLatestReadingsPeriodically());
    });
  }

  sleep = util.promisify(setTimeout);
  async getLatestReadingsPeriodically() {
    try {
      const inverterState = await getValuesAsync(this.log, this.config);

      this.log.debug("Power Gen: " + inverterState.generationWatts);
      this.log.debug("Export: " + inverterState.exportedWatts);
      this.log.debug("Battery Percentage: " + inverterState.batteryPercentage);
      this.log.debug("Battery Power: " + inverterState.batteryPowerWatts);
      this.log.debug("PV1: " + inverterState.pv1PowerWatts);
      this.log.debug("PV2: " + inverterState.pv2PowerWatts);
      this.history.addReadings(inverterState);

      this.inverterStateEmitter.emit("event");
    } catch (error) {
      this.log.debug(`Failed to read from Solax. Error: ${error}`);
    }

    this.log.debug(`Delaying for ${this.config.pollingFrequencySeconds} seconds.`);
    this.sleep(this.config.pollingFrequencySeconds * 1000).then(async () => await this.getLatestReadingsPeriodically());
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

    let battery = null;
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
    );
  }
}
