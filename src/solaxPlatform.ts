import { APIEvent } from 'homebridge';
import type { API, StaticPlatformPlugin, Logger, AccessoryPlugin, PlatformConfig } from 'homebridge';
import util from 'util';
import { getSunrise, getSunset } from 'sunrise-sunset-js';
import { getValuesAsync } from './solaxService';
import { PLATFORM_NAME, PLUGIN_NAME } from './settings';
import { WattsReaderAccessory } from './wattsReaderAccessory';
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

//     // When this event is fired it means Homebridge has restored all cached accessories from disk.
//     // Dynamic Platform plugins should only register new accessories after this event was fired,
//     // in order to ensure they weren't added to homebridge already. This event can also be used
//     // to start discovery of new accessories.
     this.api.on(APIEvent.DID_FINISH_LAUNCHING, () => {
       log.debug('Executed didFinishLaunching callback');
//       // run the method to discover / register your devices as accessories
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
      delayMillis = 60000 * 5;
    }
    // If between sunrise and sunset, we're in the daylight hours, then normal polling
    else {
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
    callback([

      new WattsReaderAccessory(this.api.hap, this.log, "Exported Watts", this.inverterStateEmitter, () => {
        return this.inverterState.ExportingWatts >= 0 ? this.inverterState.ExportingWatts : 0;
      }),
      new WattsReaderAccessory(this.api.hap, this.log, "Imported Watts", this.inverterStateEmitter, () => {
        return this.inverterState.ExportingWatts < 0 ? Math.abs(this.inverterState.ExportingWatts) : 0;
      }),
      new WattsReaderAccessory(this.api.hap, this.log, "Power Generation Watts", this.inverterStateEmitter, () => {
        return this.inverterState.PowerGenerationWatts;
      }),
    ]);
  }

} 
// /**
//  * HomebridgePlatform
//  * This class is the main constructor for your plugin, this is where you should
//  * parse the user config and discover/register accessories with Homebridge.
//  */
// export class SolaxPlatform implements DynamicPlatformPlugin {
//   public readonly Service = this.api.hap.Service;
//   public readonly Characteristic = this.api.hap.Characteristic;
//   public readonly inverterStateEmitter = new InverterStateEmitter();

//   // this is used to track restored cached accessories
//   public readonly accessories: PlatformAccessory[] = [];

//   public readonly inverterState = {
//     PowerGenerationWatts: 0,
//     ExportingWatts: 0,
//   }

//   constructor(
//     public readonly log: Logger,
//     public readonly config: PlatformConfig,
//     public readonly api: API,
//   ) {
//     this.log.debug('Finished initializing platform:', this.config.name);

//     // When this event is fired it means Homebridge has restored all cached accessories from disk.
//     // Dynamic Platform plugins should only register new accessories after this event was fired,
//     // in order to ensure they weren't added to homebridge already. This event can also be used
//     // to start discovery of new accessories.
//     this.api.on(APIEvent.DID_FINISH_LAUNCHING, () => {
//       log.debug('Executed didFinishLaunching callback');
//       // run the method to discover / register your devices as accessories
//       this.setupDevices();
//       this.pause(5000).then(() => this.getLatestReadingsPeriodically());
//     });
//   }

//   pause = util.promisify((millis: number, f: (...args: any[]) => void) => setTimeout(f, millis))
 
//   async getLatestReadingsPeriodically() {

//     try {
//       const result = await getValuesAsync(this.log);
//       this.inverterState.ExportingWatts = result.exportedWatts;
//       this.inverterState.PowerGenerationWatts = result.generationWatts;

//       this.log.debug('Power Gen: ' + result.generationWatts);
//       this.log.debug('Export: ' + result.exportedWatts);    

//       this.inverterStateEmitter.emit('event');

//     } catch(error) {
//       this.log.debug(`Failed to read from Solax. Error: ${error}`);
//     }

//     this.pause(this.determineDelayMillis()).then(() => this.getLatestReadingsPeriodically());    
//   } 

//   determineDelayMillis(): number {

//     // TODO, shift coordinates in to config
//     const latitude = -37.804993;
//     const longitude = 175.132414;

//     const now = new Date();
//     // Note, this tool actually 
//     const sunrise = getSunrise(latitude, longitude);
//     const sunset = getSunset(latitude, longitude);

//     let delayMillis: number;
//     // If before dawn, then sleep till sunrise
//     if(now < sunrise && now >= sunset) {
//       // delayMillis = sunrise.getTime() - now.getTime();
//       // const asHours = +(delayMillis / 1000 / 60 / 60).toFixed(1);
//       this.log.debug(`Reduced polling due to being outside of daylight hours. Sunrise = ${sunrise}, Sunset = ${sunset}`);
//       delayMillis = 60000 * 5;

//     }
//     // If between sunrise and sunset, we're in the daylight hours, then normal polling
//     else {
//       // TODO, maybe move this to a config item?
//       delayMillis = 60000;
//     }

//     return delayMillis;
//   }
//   /**
//    * This function is invoked when homebridge restores cached accessories from disk at startup.
//    * It should be used to setup event handlers for characteristics and update respective values.
//    */
//   configureAccessory(accessory: PlatformAccessory) {
//     this.log.info('Restoring accessory from cache:', accessory.displayName);

//     // create the accessory handler
//     // this is imported from `platformAccessory.ts`
//     new PsuedoSolaxAccessory(this, accessory, () => {
//       return Math.abs(this.inverterState.ExportingWatts)
//     });

//     // add the restored accessory to the accessories cache so we can track if it has already been registered
//     this.accessories.push(accessory);
//   }

//   /**
//    * This is an example method showing how to register discovered accessories.
//    * Accessories must only be registered once, previously created accessories
//    * must not be registered again to prevent "duplicate UUID" errors.
//    */
//   setupDevices() {

//     // EXAMPLE ONLY
//     // A real plugin you would discover accessories from the local network, cloud services
//     // or a user-defined array in the platform config.
//     const inverterPsuedoDevices = [
//       {
//         exampleUniqueId: 'exportAmount',
//         exampleDisplayName: 'Exported Watts',
//       },
//     ];

//     // loop over the discovered devices and register each one if it has not already been registered
//     for (const device of inverterPsuedoDevices) {

//       // generate a unique id for the accessory this should be generated from
//       // something globally unique, but constant, for example, the device serial
//       // number or MAC address
//       const uuid = this.api.hap.uuid.generate(device.exampleUniqueId);

//       const existingEntry = this.accessories.find(accessory => accessory.UUID === uuid);
//       // check that the device has not already been registered by checking the
//       // cached devices we stored in the `configureAccessory` method above
//       if (!existingEntry) {
//         this.log.info('Registering new accessory:', device.exampleDisplayName);

//         // create a new accessory
//         const accessory = new this.api.platformAccessory(device.exampleDisplayName, uuid);

//         // store a copy of the device object in the `accessory.context`
//         // the `context` property can be used to store any data about the accessory you may need
//         accessory.context.device = device;

//         // create the accessory handler
//         // this is imported from `platformAccessory.ts`
//         new PsuedoSolaxAccessory(this, accessory, () => {
//           return Math.abs(this.inverterState.ExportingWatts);
//         });

//         // // link the accessory to your platform
//         this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);

//         // // push into accessory cache
//         this.accessories.push(accessory);
//       }
//     }
//   }
//}
