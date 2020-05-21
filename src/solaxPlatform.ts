import { APIEvent } from 'homebridge';
import type { API, StaticPlatformPlugin, Logger, AccessoryPlugin, PlatformConfig } from 'homebridge';
import util from 'util';
import { getSunrise, getSunset } from 'sunrise-sunset-js';
import { getValuesAsync } from './solaxService';
import { WattsReadingAccessory } from './wattsReadingAccessory';
import { EventEmitter } from 'events';

export class InverterStateEmitter extends EventEmitter {}

export class SolaxPlatform implements StaticPlatformPlugin {

  public readonly inverterStateEmitter = new InverterStateEmitter();
  public readonly inverterState = {
    PowerGenerationWatts: 0,
    ExportingWatts: 0,
  }
  constructor(public readonly log: Logger, public readonly config: PlatformConfig, public readonly api: API) {

    // probably parse config or something here
     this.log.debug('Finished initializing platform:', this.config.name);

     this.api.on(APIEvent.DID_FINISH_LAUNCHING, () => {
       log.debug('Executed didFinishLaunching callback');
       this.pause(5000).then(() => this.getLatestReadingsPeriodically());
     });
  }

  pause = util.promisify((millis: number, f: (...args: any[]) => void) => setTimeout(f, millis));

  async getLatestReadingsPeriodically() {
    try {
      const result = await getValuesAsync(this.log);
      this.inverterState.ExportingWatts = result.exportedWatts;
      this.inverterState.PowerGenerationWatts = result.generationWatts;

      this.log.debug('Power Gen: ' + result.generationWatts);
      this.log.debug('Export: ' + result.exportedWatts);    

      this.inverterStateEmitter.emit('event');

    } catch(error) {
      this.log.debug(`Failed to read from Solax. Error: ${error}`);
    }

    this.pause(this.determineDelayMillis()).then(() => this.getLatestReadingsPeriodically());    
  } 

  determineDelayMillis(): number {
    // TODO, shift coordinates in to config
    const latitude = -37.804993;
    const longitude = 175.132414;

    const now = new Date();
    // Note, this tool actually 
    const sunrise = getSunrise(latitude, longitude);
    const sunset = getSunset(latitude, longitude);

    let delayMillis: number;
    // If before dawn, then sleep till sunrise
    if(now < sunrise && now >= sunset) {

      this.log.debug(`Reduced polling due to being outside of daylight hours. Sunrise = ${sunrise}, Sunset = ${sunset}`);
      delayMillis = 60000 * 1;
    }
    // If between sunrise and sunset, we're in the daylight hours, then normal polling
    else {
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
    callback([

      new WattsReadingAccessory(this.api.hap, this.log, "Exported Watts", this.inverterStateEmitter, () => {
        return this.inverterState.ExportingWatts >= 0 ? this.inverterState.ExportingWatts : 0;
      }),
      new WattsReadingAccessory(this.api.hap, this.log, "Imported Watts", this.inverterStateEmitter, () => {
        return this.inverterState.ExportingWatts < 0 ? Math.abs(this.inverterState.ExportingWatts) : 0;
      }),
      new WattsReadingAccessory(this.api.hap, this.log, "Power Generation Watts", this.inverterStateEmitter, () => {
        return this.inverterState.PowerGenerationWatts;
      }),
    ]);
  }

} 