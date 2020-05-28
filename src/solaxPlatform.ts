import { APIEvent } from "homebridge";
import type { API, StaticPlatformPlugin, Logger, AccessoryPlugin, PlatformConfig } from "homebridge";
import util from "util";
import { getSunrise, getSunset } from "sunrise-sunset-js";
import { getValuesAsync, InverterLiveMetrics } from "./solaxService";
import Config from "./config";
import WattsReadingAccessory from "./wattsReadingAccessory";
import PowerThresholdMotionSensor from "./powerThresholdMotionSensor";
import SolarBattery from "./solarBattery";
import { EventEmitter } from "events";
import _ from "lodash";

export class InverterStateEmitter extends EventEmitter {}

export class SolaxPlatform implements StaticPlatformPlugin {
  public readonly inverterStateEmitter = new InverterStateEmitter();
  public readonly config: Config;
  public inverterState: InverterLiveMetrics;

  constructor(public readonly log: Logger, config: PlatformConfig, public readonly api: API) {
    this.inverterStateEmitter.setMaxListeners(15);
    this.log.debug(`Config: \n${JSON.stringify(config, null, "  ")}`);
    this.config = this.applyDefaults(config);

    this.log.info(`Solax Host: ${this.config.address}`);
    this.log.info(`Latitude: ${this.config.latitude}`);
    this.log.info(`Longitude: ${this.config.longitude}`);
    this.log.info(`Export Alert Thresholds: [${this.config.exportAlertThresholds.join(",")}]`);
    this.log.info(`Battery: ${this.config.hasBattery}`);
    this.log.info(`Show Strings: ${this.config.showStrings}`);

    if (!this.config.latitude || !this.config.longitude) {
      this.log.warn("Ideally longtitude and latitude values should be provided in order to provide accurate sunset and sunrise timings.");
    }

    this.log.debug("Finished initializing platform:", this.config.name);
    this.inverterState = {
      generationWatts: 0,
      exportedWatts: 0,
      batteryPercentage: 0,
      batteryPowerWatts: 0,
      pv1PowerWatts: 0,
      pv2PowerWatts: 0,
    };

    this.api.on(APIEvent.DID_FINISH_LAUNCHING, () => {
      log.debug("Executed didFinishLaunching callback");
      this.sleep(5000).then(async () => await this.getLatestReadingsPeriodically());
    });
  }

  sleep = util.promisify(setTimeout);
  async getLatestReadingsPeriodically() {
    try {
      this.inverterState = await getValuesAsync(this.log, this.config);

      this.log.debug("Power Gen: " + this.inverterState.generationWatts);
      this.log.debug("Export: " + this.inverterState.exportedWatts);
      this.log.debug("Battery Percentage: " + this.inverterState.batteryPercentage);
      this.log.debug("Battery Power: " + this.inverterState.batteryPowerWatts);
      this.log.debug("PV1: " + this.inverterState.pv1PowerWatts);
      this.log.debug("PV2: " + this.inverterState.pv2PowerWatts);

      this.inverterStateEmitter.emit("event");
    } catch (error) {
      this.log.debug(`Failed to read from Solax. Error: ${error}`);
    }

    const delay = this.determineDelayMillis();
    this.log.debug(`Delaying for ${delay} milliseconds.`);
    this.sleep(delay).then(async () => await this.getLatestReadingsPeriodically());
  }

  applyDefaults(config: PlatformConfig): Config {
    const asConfig = config as Config;

    return {
      ...asConfig,
      hasBattery: asConfig.hasBattery === undefined ? true : asConfig.hasBattery,
      showStrings: asConfig.showStrings === undefined ? true : asConfig.showStrings,
      latitude: asConfig.latitude === undefined ? 0 : asConfig.latitude,
      longitude: asConfig.longitude === undefined ? 0 : asConfig.longitude,
      exportAlertThresholds: asConfig.exportAlertThresholds === null ? [] : asConfig.exportAlertThresholds,
    };
  }

  determineDelayMillis(): number {
    const now = new Date();
    const sunrise = getSunrise(this.config.latitude, this.config.longitude);
    const sunset = getSunset(this.config.latitude, this.config.longitude);

    let delayMillis: number;
    // If before dawn, then sleep till sunrise
    if (now < sunrise && now >= sunset) {
      this.log.debug(`Reduced polling due to being outside of daylight hours. Sunrise = ${sunrise}, Sunset = ${sunset}`);
      delayMillis = 60000 * 5;
    } else {
      // If between sunrise and sunset, we're in the daylight hours, then normal polling
      delayMillis = 60000;
    }

    return delayMillis;
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
        return this.inverterState.exportedWatts >= 0 ? this.inverterState.exportedWatts : 0;
      }),

      new WattsReadingAccessory(this.api.hap, this.log, "Imported Watts", this.inverterStateEmitter, () => {
        return this.inverterState.exportedWatts < 0 ? Math.abs(this.inverterState.exportedWatts) : 0;
      }),

      new WattsReadingAccessory(this.api.hap, this.log, "Power Gen Watts", this.inverterStateEmitter, () => {
        return this.inverterState.generationWatts;
      }),
    ];

    let battery = null;
    if (this.config.hasBattery) {
      const getDetails = () => {
        return {
          batteryPercentage: this.inverterState.batteryPercentage,
          batteryWatts: this.inverterState.batteryPowerWatts,
        };
      };
      battery = new SolarBattery(this.api.hap, this.log, "Solar Battery", this.inverterStateEmitter, getDetails);
    }

    const inverterStrings = this.config.showStrings
      ? [
          new WattsReadingAccessory(this.api.hap, this.log, "PV1 Watts", this.inverterStateEmitter, () => {
            return this.inverterState.pv1PowerWatts;
          }),

          new WattsReadingAccessory(this.api.hap, this.log, "PV2 Watts", this.inverterStateEmitter, () => {
            return this.inverterState.pv2PowerWatts;
          }),
        ]
      : [];

    const exportAlarms = _.map(this.config.exportAlertThresholds, (threshold) => {
      let name: string;
      let evalutation: () => boolean;

      if (threshold < 0) {
        name = `${Math.abs(threshold)} watts imported`;
        evalutation = () => this.inverterState.exportedWatts <= threshold;
      } else {
        name = `${threshold} watts exported`;
        evalutation = () => this.inverterState.exportedWatts >= threshold;
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
