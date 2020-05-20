import {
  AccessoryPlugin,
  CharacteristicGetCallback,
  CharacteristicSetCallback,
  CharacteristicValue,
  HAP,
  Logger,
  Service,
  CharacteristicEventTypes
} from "homebridge";
import { InverterStateEmitter } from './solaxPlatform';

export class WattsReaderAccessory implements AccessoryPlugin {

  private readonly log: Logger;

  private switchOn = false;

  // This property must be existent!!
  name: string;

  private readonly service: Service;
  private readonly informationService: Service;

  constructor(hap: HAP, log: Logger, name: string, public readonly inverterStateEmitter: InverterStateEmitter, public readonly getValue: () => number) {
    this.log = log;
    this.name = name;

    this.service = new hap.Service.LightSensor(name);
    this.service.getCharacteristic(hap.Characteristic.CurrentAmbientLightLevel)
      .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
        log.info(`Current state of the light sensor was returned: ${getValue()}`);
        callback(undefined, getValue());
      })

      inverterStateEmitter.on('event', () => {
        // push the new value to HomeKit
        const value = getValue()
        log.debug(`Updating value to ${value} for ${name}`)
        this.service.updateCharacteristic(hap.Characteristic.CurrentAmbientLightLevel, value);
      });
    //   .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
    //     this.switchOn = value as boolean;
    //     log.info("Switch state was set to: " + (this.switchOn? "ON": "OFF"));
    //     callback();
    //   });

    this.informationService = new hap.Service.AccessoryInformation()
      .setCharacteristic(hap.Characteristic.Manufacturer, "Solax")
      .setCharacteristic(hap.Characteristic.Model, "Inverter");

    log.info(`Solax watts reader for ${name} created!`);
  }

  /*
   * This method is optional to implement. It is called when HomeKit ask to identify the accessory.
   * Typical this only ever happens at the pairing process.
   */
  identify(): void {
    this.log.debug("Identify!");
  }

  /*
   * This method is called directly after creation of this instance.
   * It should return all services which should be added to the accessory.
   */
  getServices(): Service[] {
    return [
      this.informationService,
      this.service,
    ];
  }

}