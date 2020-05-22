import {
  AccessoryPlugin,
  CharacteristicGetCallback,
  HAP,
  Logger,
  Service,
  CharacteristicEventTypes,
} from 'homebridge';
import { InverterStateEmitter } from './solaxPlatform';

export class WattsReadingAccessory implements AccessoryPlugin {

  private readonly service: Service;
  private readonly informationService: Service;

  constructor(
    private readonly hap: HAP,
    private readonly log: Logger,
    private readonly name: string,
    private readonly inverterStateEmitter: InverterStateEmitter,
    private readonly getValue: () => number) {

    this.service = new hap.Service.LightSensor(name);
    this.service.getCharacteristic(hap.Characteristic.CurrentAmbientLightLevel)
      .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
        // Minimum value allowed for light sensor is 0.1
        const sanitisedValue = Math.max(0.1 ,getValue());
        log.info(`Current state of the light sensor was returned: ${sanitisedValue}`);
        callback(undefined, sanitisedValue);
      });

    inverterStateEmitter.on('event', () => {
      // Minimum value allowed for light sensor is 0.1
      const sanitisedValue = Math.max(0.1 ,getValue());

      log.debug(`Updating value to ${sanitisedValue} for ${name}`);
      // push the new value to HomeKit
      this.service.updateCharacteristic(hap.Characteristic.CurrentAmbientLightLevel, sanitisedValue);
    });

    this.informationService = new hap.Service.AccessoryInformation()
      .setCharacteristic(hap.Characteristic.Manufacturer, 'Solax')
      .setCharacteristic(hap.Characteristic.Model, 'Inverter');

    log.info(`Solax watts reader for ${name} created!`);
  }

  /*
   * This method is optional to implement. It is called when HomeKit ask to identify the accessory.
   * Typical this only ever happens at the pairing process.
   */
  identify(): void {
    this.log.debug('Identify!');
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