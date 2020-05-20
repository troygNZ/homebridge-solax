import { CharacteristicEventTypes } from 'homebridge';

import type { Service, PlatformAccessory, CharacteristicValue, CharacteristicSetCallback, CharacteristicGetCallback} from 'homebridge';

import { SolaxPlatform } from './solaxPlatform';

/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class PsuedoSolaxAccessory {
  private service: Service;

  /**
   * These are just used to create a working example
   * You should implement your own code to track the state of your accessory
   */
  private exampleStates = {
    Power: 0,
  }

  constructor(
    private readonly platform: SolaxPlatform,
    private readonly accessory: PlatformAccessory,
  ) {
    // set accessory information
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Solax')
      .setCharacteristic(this.platform.Characteristic.Model, 'Inverter')
      .setCharacteristic(this.platform.Characteristic.SerialNumber, 'Default-Serial');

    // get the LightBulb service if it exists, otherwise create a new LightBulb service
    // you can create multiple services for each accessory
    this.service = this.accessory.getService(this.platform.Service.LightSensor) ?? this.accessory.addService(this.platform.Service.LightSensor);

    // To avoid "Cannot add a Service with the same UUID another Service without also defining a unique 'subtype' property." error,
    // when creating multiple services of the same type, you need to use the following syntax to specify a name and subtype id:
    // this.accessory.getService('NAME') ?? this.accessory.addService(this.platform.Service.Lightbulb, 'NAME', 'USER_DEFINED_SUBTYPE');

    // set the service name, this is what is displayed as the default name on the Home app
    // in this example we are using the name we stored in the `accessory.context` in the `discoverDevices` method.
    this.service.setCharacteristic(this.platform.Characteristic.Name, accessory.context.device.exampleDisplayName);

    // each service must implement at-minimum the "required characteristics" for the given service type
    // see https://developers.homebridge.io/#/service/Lightbulb

    // // register handlers for the On/Off Characteristic
    // this.service.getCharacteristic(this.platform.Characteristic.On)
    //   .on(CharacteristicEventTypes.SET, this.setOn.bind(this))                // SET - bind to the `setOn` method below
    //   .on(CharacteristicEventTypes.GET, this.getOn.bind(this));               // GET - bind to the `getOn` method below

    // register handlers for the Brightness Characteristic
    this.service.getCharacteristic(this.platform.Characteristic.CurrentAmbientLightLevel)
      .on(CharacteristicEventTypes.GET, this.getPower.bind(this));       // SET - bind to the 'setBrightness` method below

    this.platform.inverterStateEmitter.on('event', () => {
      // push the new value to HomeKit
      // TODO: Remvove ABS
      const exportedWatts = Math.abs(this.platform.inverterState.ExportingWatts);
      this.platform.log.debug(`Updating value to ${exportedWatts}`)

      this.service.updateCharacteristic(this.platform.Characteristic.CurrentAmbientLightLevel, exportedWatts);
    });
  }

  /**
   * Handle the "GET" requests from HomeKit
   * These are sent when HomeKit wants to know the current state of the accessory, for example, checking if a Light bulb is on.
   * 
   * GET requests should return as fast as possbile. A long delay here will result in
   * HomeKit being unresponsive and a bad user experience in general.
   * 
   * If your device takes time to respond you should update the status of your device
   * asynchronously instead using the `updateCharacteristic` method instead.

   * @example
   * this.service.updateCharacteristic(this.platform.Characteristic.On, true)
   */
  getPower(callback: CharacteristicGetCallback) {

    // implement your own code to check if the device is on
    const power = this.exampleStates.Power;

    this.platform.log.debug('Get Characteristic Power ->', power);

    // you must call the callback function
    // the first argument should be null if there were no errors
    // the second argument should be the value to return
    callback(null, power);
  }
}
