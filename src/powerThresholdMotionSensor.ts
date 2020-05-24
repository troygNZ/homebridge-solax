import {
  AccessoryPlugin,
  HAP,
  Logger,
  Service,
} from 'homebridge';
import { InverterStateEmitter } from './solaxPlatform';

export default class PowerThresholdMotionSensor implements AccessoryPlugin {

  private readonly service: Service;
  private readonly informationService: Service;

  constructor(
    private readonly hap: HAP,
    private readonly log: Logger,
    private readonly name: string,
    private readonly inverterStateEmitter: InverterStateEmitter,
    private readonly shouldTrigger: () => boolean) {

    this.service = new hap.Service.MotionSensor(name);
    this.service.name = name;
         // create handlers for required characteristics
    this.service.getCharacteristic(hap.Characteristic.MotionDetected)
         .on('get', this.handleMotionDetectedGet.bind(this));

    inverterStateEmitter.on('event', () => {
      // push the new value to HomeKit
      const triggered = this.shouldTrigger();
      if(triggered) {
        this.log.debug(`${this.name} - shouldTrigger() = ${triggered}`);
      }

      this.service.updateCharacteristic(hap.Characteristic.MotionDetected, triggered);
    });

    this.informationService = new hap.Service.AccessoryInformation()
      .setCharacteristic(hap.Characteristic.Manufacturer, 'Solax')
      .setCharacteristic(hap.Characteristic.Model, 'Inverter');

    log.info(`Solax watts reader for ${name} created!`);
  }

  handleMotionDetectedGet = (callback: any): void => {
    this.log.debug('Triggered GET MotionDetected');
    callback(null, this.shouldTrigger());
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