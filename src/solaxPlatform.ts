import { APIEvent } from "homebridge";
import type { API, StaticPlatformPlugin, Logger, AccessoryPlugin, PlatformConfig } from "homebridge";
import util from "util";
import { getSunrise, getSunset } from "sunrise-sunset-js";
import { getValuesAsync } from "./solaxService";
import Config from "./config";
import WattsReadingAccessory from "./wattsReadingAccessory";
import PowerThresholdMotionSensor from "./powerThresholdMotionSensor";
import { EventEmitter } from "events";
import _ from "lodash";

export class InverterStateEmitter extends EventEmitter {}

export class SolaxPlatform implements StaticPlatformPlugin {
  public readonly inverterStateEmitter = new InverterStateEmitter();
  public readonly config: Config;
  public readonly inverterState = {
    PowerGenerationWatts: 0,
    ExportingWatts: 0,
  };

  constructor(public readonly log: Logger, config: PlatformConfig, public readonly api: API) {
    this.inverterStateEmitter.setMaxListeners(15);
    this.log.debug(`Config: \n${JSON.stringify(config, null, "  ")}`);
    this.config = config as Config;
    this.log.info(`Solax Host: ${this.config.address}`);
    this.log.info(`Latitude: ${this.config.latitude}`);
    this.log.info(`Longitude: ${this.config.longitude}`);
    this.log.info(`Export Alert Thresholds: [${this.config.exportAlertThresholds ? this.config.exportAlertThresholds.join(",") : []}]`);
    if (!this.config.latitude || !this.config.longitude) {
      this.log.warn("Ideally longtitude and latitude values should be provided in order to provide accurate sunset and sunrise timings.");
    }

    this.log.debug("Finished initializing platform:", this.config.name);

    this.api.on(APIEvent.DID_FINISH_LAUNCHING, () => {
      log.debug("Executed didFinishLaunching callback");
      this.sleep(5000).then(async () => await this.getLatestReadingsPeriodically());
    });
  }

  sleep = util.promisify(setTimeout);
  async getLatestReadingsPeriodically() {
    try {
      const result = await getValuesAsync(this.log, this.config);
      this.inverterState.ExportingWatts = result.exportedWatts;
      this.inverterState.PowerGenerationWatts = result.generationWatts;

      this.log.debug("Power Gen: " + result.generationWatts);
      this.log.debug("Export: " + result.exportedWatts);

      this.inverterStateEmitter.emit("event");
    } catch (error) {
      this.log.debug(`Failed to read from Solax. Error: ${error}`);
    }

    const delay = this.determineDelayMillis();
    this.log.debug(`Delaying for ${delay} milliseconds.`);
    this.sleep(delay).then(async () => await this.getLatestReadingsPeriodically());
  }

  determineDelayMillis(): number {
    const now = new Date();
    const sunrise = getSunrise(this.config.latitude ?? 0, this.config.longitude ?? 0);
    const sunset = getSunset(this.config.latitude ?? 0, this.config.longitude ?? 0);

    let delayMillis: number;
    // If before dawn, then sleep till sunrise
    if (now < sunrise && now >= sunset) {
      this.log.debug(`Reduced polling due to being outside of daylight hours. Sunrise = ${sunrise}, Sunset = ${sunset}`);
      delayMillis = 60000 * 1;
    } else {
      // If between sunrise and sunset, we're in the daylight hours, then normal polling
      delayMillis = 30000;
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
    const exportAlertThresholds = this.config.exportAlertThresholds ? this.config.exportAlertThresholds : [];
    const accessories: AccessoryPlugin[] = [
      new WattsReadingAccessory(this.api.hap, this.log, "Exported Watts", this.inverterStateEmitter, () => {
        return this.inverterState.ExportingWatts >= 0 ? this.inverterState.ExportingWatts : 0;
      }),

      new WattsReadingAccessory(this.api.hap, this.log, "Imported Watts", this.inverterStateEmitter, () => {
        return this.inverterState.ExportingWatts < 0 ? Math.abs(this.inverterState.ExportingWatts) : 0;
      }),

      new WattsReadingAccessory(this.api.hap, this.log, "Power Gen Watts", this.inverterStateEmitter, () => {
        return this.inverterState.PowerGenerationWatts;
      }),
    ];

    const exportAlarms = _.map(exportAlertThresholds, (threshold) => {
      let name: string;
      let evalutation: () => boolean;

      if (threshold < 0) {
        name = `${Math.abs(threshold)} watts imported`;
        evalutation = () => this.inverterState.ExportingWatts <= threshold;
      } else {
        name = `${threshold} watts exported`;
        evalutation = () => this.inverterState.ExportingWatts >= threshold;
      }

      return new PowerThresholdMotionSensor(this.api.hap, this.log, name, this.inverterStateEmitter, evalutation);
    });

    return callback(accessories.concat(exportAlarms));
  }
}
